# /job-adapt - Geração Contextualizada

Gera currículo adaptado e carta de apresentação para uma vaga específica.

## Uso
```
/job-adapt [vaga_id]
```

## Processo
1. Carrega profile.json (consolidado)
2. Analisa requisitos da vaga
3. Reordena skills por relevância
4. Re-enfatiza bullets de experiência
5. Gera carta de 3-4 parágrafos
6. Voice Linting: verifica qualidade da prosa
7. Salva PDFs: currículo-adaptado + carta

## Regras
- NUNCA inventar skills ou experiências
- Preservar verdades factuais
- Revisão humana obrigatória antes de aplicar
