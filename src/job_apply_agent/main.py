"""
Job Application Workflow - Entry Point

Orquestra o pipeline completo: busca → análise → consolidação → KB → geração → aplicação → tracking.

Uso:
    python -m src.job_apply_agent.main [comando] [args]

Comandos:
    search      Busca vagas
    analyze     Calcula match score
    consolidate Consolida PDFs em DOCX+PDF+KB
    kb          Gera Knowledge Base .md do candidato
    adapt       Gera currículo adaptado (DOCX) + carta (TXT)
    apply       Aplica para vagas
    track       Gerencia candidaturas
"""
import sys
import json
from pathlib import Path

# Adiciona src ao path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.job_apply_agent.config import load_profile, save_profile, PROFILE_DIR, PROJECT_DATA_DIR


def cmd_search(args: list[str]) -> None:
    """Busca vagas em múltiplas plataformas."""
    from src.job_apply_agent.search import search_all_platforms, consolidate_results
    query = args[0] if len(args) > 0 else input("Termo de busca: ")
    location = args[1] if len(args) > 1 else input("Localização: ")
    filters = args[2] if len(args) > 2 else ""

    print(f"🔍 Buscando '{query}' em {location}...")
    results = search_all_platforms(query, location, filters)
    consolidated = consolidate_results(results)

    output_path = PROFILE_DIR / "search_results.json"
    output_path.write_text(json.dumps(consolidated, indent=2, ensure_ascii=False))
    print(f"✅ {len(consolidated)} vagas encontradas. Resultados salvos em {output_path}")


def cmd_analyze(args: list[str]) -> None:
    """Calcula match score para vagas."""
    from src.job_apply_agent.analyzer import analyze_jobs

    profile = load_profile()
    if not profile:
        print("❌ profile.json não encontrado. Execute /job-consolidate primeiro.")
        return

    results_path = PROFILE_DIR / "search_results.json"
    if not results_path.exists():
        print("❌ Nenhum resultado de busca. Execute /job-search primeiro.")
        return

    jobs = json.loads(results_path.read_text())
    job_id = args[0] if args else None

    print("📊 Analisando compatibilidade...")
    ranked = analyze_jobs(profile, jobs, job_id)

    output_path = PROFILE_DIR / "analyzed_results.json"
    output_path.write_text(json.dumps(ranked, indent=2, ensure_ascii=False))
    print(f"✅ Análise concluída. Resultados salvos em {output_path}")


def cmd_kb(args: list[str]) -> None:
    """Gera Knowledge Base .md com currículo completo do candidato."""
    from src.job_apply_agent.consolidator import consolidate_pdfs_to_kb, docx_to_kb

    if not args:
        print("❌ Informe ao menos 1 arquivo de currículo: /job-kb [arquivo1] [arquivo2] ...")
        return

    file_paths = [Path(p) for p in args if Path(p).exists()]
    if not file_paths:
        print("❌ Nenhum arquivo válido encontrado.")
        return

    # Separa DOCX de PDFs
    docx_paths = [p for p in file_paths if p.suffix.lower() == ".docx"]
    pdf_paths = [p for p in file_paths if p.suffix.lower() == ".pdf"]

    # Suporta flag --output
    output_dir = PROFILE_DIR / "output"
    if "--output" in args:
        idx = args.index("--output")
        if idx + 1 < len(args):
            output_dir = Path(args[idx + 1])

    # Suporta flag --json (gera também profile.json)
    generate_json = "--json" in args
    generate_docx = "--docx" in args

    if docx_paths:
        # Processa DOCX via docx_to_kb()
        for docx_path in docx_paths:
            print(f"📄 Processando DOCX: {docx_path.name}...")
            result = docx_to_kb(docx_path, output_dir)
            kb_path = result.get("kb_path", "")
            print(f"✅ Knowledge Base gerada: {kb_path}")
            if generate_json and result.get("profile"):
                save_profile(result["profile"])
                print(f"✅ Perfil salvo em {PROFILE_DIR / 'profile.json'}")
        return

    # Processamento de PDFs (comportamento original)
    if not pdf_paths:
        print("❌ Nenhum arquivo .pdf ou .docx válido encontrado.")
        return

    print(f"📄 Consolidando {len(pdf_paths)} arquivo(s) em Knowledge Base...")

    if generate_json or generate_docx:
        from src.job_apply_agent.consolidator import consolidate_pdfs_to_docx
        result = consolidate_pdfs_to_docx(pdf_paths, output_dir / "kb_output")
        kb_path = result.get("kb_path", "")
        if generate_json and result.get("profile"):
            save_profile(result["profile"])
            print(f"✅ Perfil salvo em {PROFILE_DIR / 'profile.json'}")
        if generate_docx:
            print(f"✅ DOCX gerado: {result.get('docx_path')}")
    else:
        # Apenas KB (modo limpo)
        result = consolidate_pdfs_to_kb(pdf_paths, output_dir)
        kb_path = result.get("kb_path", "")

    print(f"✅ Knowledge Base gerada: {kb_path}")
    print(f"💡 Use /job-adapt [vaga_id] para criar currículo adaptado a partir desta KB.")


def cmd_consolidate(args: list[str]) -> None:
    """Consolida PDFs em DOCX ATS de 1 página + KB."""
    from src.job_apply_agent.consolidator import consolidate_pdfs_to_docx

    if not args:
        print("❌ Informe ao menos 1 PDF: /job-consolidate [pdf1] [pdf2] ...")
        return

    pdf_paths = [Path(p) for p in args if Path(p).exists()]
    if not pdf_paths:
        print("❌ Nenhum arquivo PDF válido encontrado.")
        return

    output_dir = PROFILE_DIR / "output"
    output_dir.mkdir(exist_ok=True)

    print(f"📄 Consolidando {len(pdf_paths)} PDFs...")
    result = consolidate_pdfs_to_docx(pdf_paths, output_dir)

    if result.get("profile"):
        save_profile(result["profile"])
        print(f"✅ Perfil salvo em {PROFILE_DIR / 'profile.json'}")

    print(f"✅ DOCX gerado: {result.get('docx_path')}")
    print(f"✅ PDF gerado: {result.get('pdf_path')}")

    # Knowledge Base (nova saída)
    if result.get("kb_path"):
        print(f"✅ Knowledge Base gerada: {result.get('kb_path')}")


def cmd_adapt(args: list[str]) -> None:
    """Gera currículo adaptado (DOCX) e carta (TXT)."""
    from src.job_apply_agent.generator import generate_application

    profile = load_profile()
    if not profile:
        print("❌ profile.json não encontrado. Execute /job-consolidate primeiro.")
        return

    analyzed_path = PROFILE_DIR / "analyzed_results.json"
    if not analyzed_path.exists():
        print("❌ Nenhuma análise. Execute /job-analyze primeiro.")
        return

    jobs = json.loads(analyzed_path.read_text())
    if not args:
        print("❌ Informe o ID da vaga: /job-adapt [vaga_id]")
        return

    job_id = args[0]
    job = next((j for j in jobs if j.get("id") == job_id), None)
    if not job:
        print(f"❌ Vaga {job_id} não encontrada.")
        return

    # Verifica match score - se match > 70%, prossegue; senão, mostra match e pára
    match_score = job.get("score", 0)
    if match_score <= 70:
        print(f"📊 Match score: {match_score}% para {job.get('title', job_id)}")
        print(f"⚠️  Match abaixo do limiar (70%). Não gerando materiais adaptados.")
        print(f"💡 Considere candidatar-se a vagas com maior compatibilidade.")
        return

    print(f"📊 Match score: {match_score}% para {job.get('title', job_id)}")
    print(f"📝 Gerando materiais para {job.get('title', job_id)}...")

    # Salva em data/job-apply-agent/<vaga_id>/ (regra v1.2.0+)
    output_dir = PROJECT_DATA_DIR / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    result = generate_application(profile, job, output_dir)

    print(f"✅ Currículo adaptado (DOCX): {result.get('resume_path')}")
    print(f"✅ Carta de apresentação (TXT): {result.get('cover_letter_path')}")
    print(f"⚠️  Revisão humana necessária antes de aplicar.")


def cmd_apply(args: list[str]) -> None:
    """Executa aplicação com aprovação humana."""
    from src.job_apply_agent.applicator import run_application_loop
    from src.job_apply_agent.deduplicator import check_duplicate

    if not args:
        print("❌ Informe o ID da vaga: /job-apply [vaga_id]")
        return

    job_id = args[0]
    is_batch = args[0] == "--batch"
    threshold = int(args[1]) if is_batch and len(args) > 1 else 70

    analyzed_path = PROFILE_DIR / "analyzed_results.json"
    all_jobs = json.loads(analyzed_path.read_text()) if analyzed_path.exists() else []

    if is_batch:
        target_jobs = [j for j in all_jobs if j.get("score", 0) >= threshold]
    else:
        job = next((j for j in all_jobs if j.get("id") == job_id), None)
        if not job:
            print(f"❌ Vaga {job_id} não encontrada nos resultados analisados.")
            return
        target_jobs = [job]

    for job in target_jobs:
        if check_duplicate(job.get("company", ""), job.get("title", "")):
            print(f"⏭️  {job.get('title', job.get('id'))} já foi aplicada. Pulando.")
            continue
        run_application_loop(job)

    print("✅ Processo de aplicação concluído.")


def cmd_track(args: list[str]) -> None:
    """Gerencia histórico de candidaturas."""
    from src.job_apply_agent.tracker import (
        list_applications,
        export_csv,
        export_json,
        update_status,
    )

    if not args:
        apps = list_applications()
        print(f"{'ID':<20} {'Empresa':<20} {'Vaga':<30} {'Status':<15} {'Data':<12}")
        print("-" * 97)
        for app in apps:
            print(f"{app.get('id', ''):<20} {app.get('company', ''):<20} "
                  f"{app.get('title', ''):<30} {app.get('status', ''):<15} "
                  f"{app.get('date', ''):<12}")
        return

    if args[0] == "export" and len(args) > 1:
        output_path = PROFILE_DIR / f"applications.{args[1]}"
        if args[1] == "csv":
            export_csv(output_path)
        elif args[1] == "json":
            export_json(output_path)
        print(f"✅ Exportado para {output_path}")
        return

    if args[0] == "update" and len(args) >= 3:
        update_status(args[1], args[2])
        print(f"✅ Status da candidatura {args[1]} atualizado para '{args[2]}'")
        return


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        return

    command = sys.argv[1]
    args = sys.argv[2:]

    commands = {
        "search": cmd_search,
        "analyze": cmd_analyze,
        "kb": cmd_kb,
        "consolidate": cmd_consolidate,
        "adapt": cmd_adapt,
        "apply": cmd_apply,
        "track": cmd_track,
    }

    if command in commands:
        commands[command](args)
    else:
        print(f"❌ Comando desconhecido: {command}")
        print("Comandos disponíveis: search, analyze, consolidate, kb, adapt, apply, track")


if __name__ == "__main__":
    main()
