"""
Job Application Workflow - Entry Point

Orquestra o pipeline completo: busca → análise → consolidação → geração → aplicação → tracking.

Uso:
    python -m src.job_apply_agent.main [comando] [args]
"""
import sys
import json
from pathlib import Path

# Adiciona src ao path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from src.job_apply_agent.config import load_profile, save_profile, PROFILE_DIR


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


def cmd_consolidate(args: list[str]) -> None:
    """Consolida PDFs em DOCX ATS de 1 página."""
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


def cmd_adapt(args: list[str]) -> None:
    """Gera currículo adaptado e carta."""
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

    output_dir = PROFILE_DIR / "output" / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"📝 Gerando materiais para {job.get('title', job_id)}...")
    result = generate_application(profile, job, output_dir)

    print(f"✅ Currículo adaptado: {result.get('resume_path')}")
    print(f"✅ Carta de apresentação: {result.get('cover_letter_path')}")
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

    if is_batch:
        analyzed_path = PROFILE_DIR / "analyzed_results.json"
        jobs = json.loads(analyzed_path.read_text()) if analyzed_path.exists() else []
        target_jobs = [j for j in jobs if j.get("score", 0) >= threshold]
    else:
        target_jobs = [{"id": job_id}]

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
        "consolidate": cmd_consolidate,
        "adapt": cmd_adapt,
        "apply": cmd_apply,
        "track": cmd_track,
    }

    if command in commands:
        commands[command](args)
    else:
        print(f"❌ Comando desconhecido: {command}")
        print("Comandos disponíveis: search, analyze, consolidate, adapt, apply, track")


if __name__ == "__main__":
    main()
