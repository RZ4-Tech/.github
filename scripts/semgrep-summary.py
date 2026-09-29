"""Resume o JSON do Semgrep no job summary e em anotações no PR.

No plano Free com repo privado não há Code Scanning (aba Security), então o
relatório vai por aqui: tabela no resumo do job + anotação na linha do arquivo.
Só reporta — nunca falha o job.
"""
import json
import os
import sys


def esc(texto: str) -> str:
    # Formato dos workflow commands: %, \r e \n precisam ser escapados.
    return texto.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def main() -> None:
    caminho = sys.argv[1]
    if not os.path.exists(caminho):
        print("::warning title=Semgrep::semgrep não gerou relatório (ver log do passo anterior)")
        return

    with open(caminho, encoding="utf-8") as f:
        dados = json.load(f)
    achados = dados.get("results", [])
    base = os.environ.get("BASE")

    linhas = [f"## Semgrep — {len(achados)} achado(s)", ""]
    linhas.append(
        "Só o que este PR introduziu (comparado com a base)." if base else "Varredura completa do repositório."
    )
    linhas.append("")

    if achados:
        linhas += ["| Severidade | Regra | Arquivo |", "|---|---|---|"]
        for r in achados:
            sev = r["extra"].get("severity", "INFO")
            regra = r["check_id"].split(".")[-1]
            arquivo, linha = r["path"], r["start"]["line"]
            msg = " ".join(r["extra"].get("message", "").split())
            linhas.append(f"| {sev} | `{regra}` | `{arquivo}:{linha}` |")
            nivel = "error" if sev == "ERROR" else "warning"
            print(f"::{nivel} file={arquivo},line={linha},title=Semgrep: {regra}::{esc(msg[:500])}")

    erros = dados.get("errors", [])
    if erros:
        linhas += ["", f"{len(erros)} arquivo(s) não foram analisados por completo (erro de parser)."]

    resumo = os.environ.get("GITHUB_STEP_SUMMARY")
    if resumo:
        with open(resumo, "a", encoding="utf-8") as f:
            f.write("\n".join(linhas) + "\n")
    else:
        print("\n".join(linhas))


main()
