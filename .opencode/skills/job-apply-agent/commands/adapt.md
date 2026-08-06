# /job-adapt - Geração Contextualizada

Gera currículo adaptado à vaga e carta de apresentação usando Ollama + fallback.

## Uso
```
/job-adapt [vaga_id]
```

## Processo
1. Carrega perfil do candidato (profile.json)
2. Carrega análise da vaga (analyzed_results.json)
3. **Verifica match score** - se match > 70%, prossegue; senão, mostra match e pára
4. Gera resumo profissional adaptado via Ollama (ou fallback inteligente)
5. Filtra habilidades, experiências e projetos por relevância com a vaga
6. Gera carta de apresentação contextualizada
7. Gera arquivos de saída (MD, DOCX, PDF, TXT)

## Dependências
- Requer `profile.json` (gerado por `/job-consolidate`)
- Requer `analyzed_results.json` (gerado por `/job-analyze`) com `strengths` e `gaps`

## Arquivos gerados
- `data/job-apply-agent/[vaga_id]/resume_adapted.md` (Markdown editável)
- `data/job-apply-agent/[vaga_id]/resume_adapted.docx` (DOCX para envio)
- `data/job-apply-agent/[vaga_id]/resume_adapted.pdf` (PDF para envio, máx. 2 páginas)
- `data/job-apply-agent/[vaga_id]/cover_letter.txt` (Carta de apresentação)

## Execução
Para gerar os materiais, rode o comando Python com o ID da vaga:
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent adapt [vaga_id]
```

Ou via wrapper:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py adapt [vaga_id]
```

## Lógica de Match Score
O comando verifica automaticamente o match score calculado por `/job-analyze`:
- **Match > 70%**: Gera currículo adaptado + carta de apresentação
- **Match ≤ 70%**: Mostra o match score e pára (sem gerar materiais)

**Exemplo de saída para match baixo:**
```
📊 Match score: 65% para Desenvolvedor Frontend Júnior
⚠️  Match abaixo do limiar (70%). Não gerando materiais adaptados.
💡 Considere candidatar-se a vagas com maior compatibilidade.
```

**Exemplo de saída para match alto:**
```
📊 Match score: 85% para Desenvolvedor Frontend Júnior
📝 Gerando materiais para Desenvolvedor Frontend Júnior...
✅ Currículo adaptado (DOCX): data/job-apply-agent/li-0001/resume_adapted.docx
✅ Carta de apresentação (TXT): data/job-apply-agent/li-0001/cover_letter.txt
⚠️  Revisão humana necessária antes de aplicar.
```

## Lógica de Adaptação
O sistema adapta o currículo à vaga usando as seguintes estratégias:

### 1. Resumo Profissional
- **Com Ollama**: Gera resumo contextualizado via prompt específico
- **Sem Ollama (fallback)**: Usa `_build_smart_summary()` que:
  - Identifica o foco da vaga a partir do título
  - Enfatiza as `strengths` identificadas na análise
  - Mantém o resumo original como complemento

### 2. Habilidades Técnicas
- Filtra skills por relevância com palavras-chave da vaga
- Mantém no máximo `MAX_SKILLS` (8) habilidades mais relevantes
- Preserva ordem original do perfil entre as selecionadas

### 3. Experiência Profissional
- Seleciona no máximo `MAX_ROLES` (2) cargos mais relevantes
- Limita a `MAX_BULLETS_PER_ROLE` (2) bullets por cargo
- Usa `experience_raw` quando disponível (preserva bullets originais)

### 4. Certificações e Projetos
- Filtra por relevância com a vaga
- Mantém no máximo `MAX_CERTS` (2) certificações
- Mantém no máximo `MAX_PROJECTS` (1) projetos

### 5. Carta de Apresentação
- **Com Ollama**: Gera carta personalizada via prompt específico
- **Sem Ollama (fallback)**: Usa template com dados da vaga e do candidato
