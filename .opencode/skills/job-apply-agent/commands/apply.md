# /job-apply - Aplicação Semiautomática

Executa a candidatura com aprovação humana via Chrome/Playwright MCP.

## Uso
```
/job-apply [vaga_id | --batch [threshold]]
```

## Modos
- `/job-apply [vaga_id]` → Aplica para vaga específica (requer aprovação humana)
- `/job-apply --batch [threshold]` → Aplica para todas as vagas com score >= threshold (default: 70)

## Processo
1. Voice lint do perfil (verifica se dados obrigatórios estão preenchidos)
2. Localiza currículo adaptado e carta gerados
3. **Verifica match score** - se match < 70%, pára (sem aplicação)
4. Solicita aprovação humana (via input interativo)
5. Navega para URL da vaga via MCP apropriado (Chrome ou Playwright)
6. Preenche formulário da plataforma
7. Registra resultado (aplicado ou pulado)

## Dependências
- Requer `profile.json` e arquivos gerados por `/job-adapt`
- Requer MCPs configurados (Chrome DevTools, Playwright)

## Execução
Para executar a aplicação, rode o comando Python com o ID da vaga:
```bash
cd /workspaces/nexus-7-agent && PYTHONPATH=src python -m src.job_apply_agent apply [vaga_id]
```

Ou via wrapper:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py apply [vaga_id]
```

Para modo batch:
```bash
cd /workspaces/nexus-7-agent && python3 run_job_agent.py apply --batch 80
```

## Lógica de Match Score
O comando verifica automaticamente o match score calculado por `/job-analyze`:
- **Match < 70%**: Pára a aplicação (não é elegível)
- **Match ≥ 70%**: Prossegue com a aplicação (requer aprovação humana)

**Exemplo de saída para match baixo:**
```
📊 Match score: 65% para Desenvolvedor Frontend Júnior
⚠️  Match abaixo do limiar (70%). Candidatura não permitida.
💡 Considere candidatar-se a vagas com maior compatibilidade.
```

**Exemplo de saída para match alto (após aprovação humana):**
```
📊 Match score: 85% para Desenvolvedor Frontend Júnior
📝 Verificando materiais...
✅ Currículo adaptado encontrado: output/li-0001/resume_adapted.docx
✅ Carta de apresentação encontrada: output/li-0001/cover_letter.txt

👤 Dados do candidato:
   • Nome: Rafael Augusto Nascimento Novais
   • Email: rafaelaugustonnovais@gmail.com
   • LinkedIn: linkedin.com/in/rafaelnovais042

💼 Detalhes da vaga:
   • Cargo: Desenvolvedor Frontend Júnior
   • Empresa: Visto
   • Match: 85% [ALTA]

❓ Deseja aplicar para esta vaga? (s/n): s

🚀 Aplicando para Desenvolvedor Frontend Júnior na Visto...
✅ Candidatura enviada com sucesso!
📝 Resultado salvo em applied.jsonl
```
