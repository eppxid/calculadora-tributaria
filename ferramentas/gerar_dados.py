"""Gera dados/simples.js a partir do PDF oficial da LC 214 e valida cada tabela."""
import json
import re
import sys

import pdfplumber

pdf_path, saida = sys.argv[1], sys.argv[2]
ANEXOS = {"ANEXO I": "I", "ANEXO II": "II", "ANEXO III": "III", "ANEXO IV": "IV", "ANEXO V": "V"}


def pct(c):
    m = re.search(r"(\d{1,3}(?:\.\d{3})*,\d+)\s*%?", c or "")
    return float(m.group(1).replace(".", "").replace(",", ".")) if m else None


brutos = {}
anexo = periodo = cab = None
with pdfplumber.open(pdf_path) as pdf:
    for pag in pdf.pages[282:]:
        eventos = []
        tabs = pag.find_tables()
        caixas = [t.bbox for t in tabs]
        for lin in pag.extract_text_lines():
            if not any(b[1] - 1 <= lin["top"] <= b[3] + 1 for b in caixas):
                eventos.append((lin["top"], "t", lin["text"].strip()))
        for t in tabs:
            eventos.append((t.bbox[1], "T", t.extract()))
        eventos.sort(key=lambda e: e[0])
        for _, tipo, v in eventos:
            if tipo == "t":
                if v in ANEXOS:
                    anexo = ANEXOS[v]
                    brutos.setdefault(anexo, {"aliquotas": {}, "partilha": {}})
                    periodo = None
                elif v.startswith("ANEXO XXIII"):
                    anexo = None
                m = re.search(r"Vig.ncia: 1.?/1/(\d{4})", v)
                if m:
                    periodo = m.group(1)
                continue
            for lin in v:
                c = [("" if x is None else x.replace("\n", " ").strip()) for x in lin]
                if "IRPJ" in c:
                    cab = [x.replace(" (*)", "") for x in c if x and x != "Faixas" and "Percentual" not in x]
                    continue
                f = re.match(r"(\d)\D{0,3}Faixa", c[0]) if c[0] else None
                if not f or anexo is None:
                    continue
                n = int(f.group(1))
                if len(c) >= 4 and re.search(r"(At.|De)\s+[\d.]", c[1]):
                    brutos[anexo]["aliquotas"].setdefault(periodo, {})[n] = [pct(c[2]), pct(c[3]) or 0.0]
                    continue
                reg = brutos[anexo]["partilha"].setdefault(periodo, {"cab": list(cab), "lin": {}, "teto": None})
                if "efetiva" in " ".join(c[1:]).lower() or "fixo" in " ".join(c[1:]).lower():
                    teto = {}
                    for nome, cel in zip(reg["cab"], c[1:]):
                        if "fixo" in cel.lower():
                            teto["ISS"] = float(re.search(r"([\d,]+)%", cel).group(1).replace(",", "."))
                            continue
                        m = re.search(r"-\s*([\d,]+)%\)\s*x\s*([\d,]+)%", cel)
                        teto[nome] = float(m.group(2).replace(",", "."))
                    reg["teto"] = teto
                else:
                    reg["lin"][n] = {nome: (pct(x) or 0.0) for nome, x in zip(reg["cab"], c[1:])}

PERIODOS = ["2027", "2029", "2030", "2031", "2032", "2033"]
for a, d in brutos.items():
    assert sorted(d["aliquotas"]) == ["2027", "2029"], (a, sorted(d["aliquotas"]))
    assert sorted(d["partilha"]) == PERIODOS, (a, sorted(d["partilha"]))
    for p, x in d["partilha"].items():
        assert sorted(x["lin"]) == [1, 2, 3, 4, 5, 6], (a, p, sorted(x["lin"]))
        for n, lin in x["lin"].items():
            soma = round(sum(lin.values()), 2)
            assert soma == 100.0, (a, p, n, soma, lin)
        if x["teto"]:
            assert x["teto"]["ISS"] > 0, (a, p, "teto ISS")
            soma = round(sum(v for k, v in x["teto"].items() if k != "ISS"), 2)
            assert abs(soma - 100.0) <= 0.05, (a, p, "teto", soma, x["teto"])

# Tabela de 2026 (LC 155/2016): mesmas alíquotas de 2029 e, na partilha,
# PIS+Cofins na fatia da CBS de 2029 e ICMS/ISS na fatia do IBS de 2033.
for a, d in brutos.items():
    d["aliquotas"]["2026"] = d["aliquotas"]["2029"]
    base = d["partilha"]["2029"]
    fim = d["partilha"]["2033"]
    consumo = "ICMS" if "ICMS" in base["cab"] else "ISS"
    lin = {}
    for n, r in base["lin"].items():
        novo = {k: v for k, v in r.items() if k not in ("CBS", "IBS", "ICMS", "ISS")}
        novo["PIS_COFINS"] = r["CBS"]
        novo[consumo] = fim["lin"][n]["IBS"]
        assert round(sum(novo.values()), 2) == 100.0, (a, n, novo)
        lin[n] = novo
    teto = None
    tb = d["partilha"]["2027"]["teto"]
    if tb:
        teto = {k: v for k, v in tb.items() if k not in ("CBS", "IBS")}
        teto["PIS_COFINS"] = round(tb["CBS"] + tb["IBS"], 2)
    d["partilha"]["2026"] = {"lin": lin, "teto": teto}

saida_js = {a: {"aliquotas": d["aliquotas"], "partilha": {p: {"lin": x["lin"], "teto": x["teto"]} for p, x in d["partilha"].items()}} for a, d in brutos.items()}
texto = json.dumps(saida_js, ensure_ascii=False, indent=1, sort_keys=True)
with open(saida, "w", encoding="utf-8", newline="\n") as f:
    f.write("// Gerado do PDF oficial da LC 214/2025 atualizada (Anexos XVIII a XXII) e da LC 155/2016.\n")
    f.write("// Não editar à mão. Chaves: período → faixa → tributo (%).\n")
    f.write("export const SIMPLES = " + texto + ";\n")
print("ok", {a: sorted(d["partilha"]) for a, d in saida_js.items()})
