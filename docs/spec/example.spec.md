---
title: "Relatório Mensal de Transações"
status: "approved"
author: "Nexus Orquestrador"
created: "2026-05-13"
updated: "2026-05-13"
version: "1.0.0"
---

# Relatório Mensal de Transações — Spec

## 1. Visão Geral

**Problema:** Usuários precisam visualizar um resumo financeiro mensal com total de receitas, despesas e saldo.

**Usuário alvo:** Usuários logados com contas ativas.

**Contexto:** Módulo de relatórios do dashboard financeiro, acessível via menu lateral.

---

## 2. Requisitos Funcionais

### REQ-001: Selecionar mês/ano para relatório

**Descrição:** O sistema deve permitir que o usuário selecione mês e ano para gerar o relatório.
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Seletor de mês com 12 opções (janeiro a dezembro)
- [ ] Seletor de ano com range de 5 anos (ano atual - 4)
- [ ] Valor padrão: mês e ano corrente
**Casos de Teste:**
- `CT-001.1`: Selecionar mês 03/2026 → relatório exibido
- `CT-001.2`: Selecionar mês futuro → mensagem "sem dados"
- `CT-001.3`: Ano anterior ao range → campo desabilitado

### REQ-002: Exibir resumo financeiro

**Descrição:** O relatório deve exibir total de receitas, total de despesas e saldo (receitas - despesas).
**Prioridade:** Alta
**Critérios de Aceitação:**
- [ ] Três cards: Receitas (verde), Despesas (vermelho), Saldo (azul)
- [ ] Valores formatados em moeda BRL (R$ 1.234,56)
- [ ] Saldo negativo destacado em vermelho
**Casos de Teste:**
- `CT-002.1`: Mês com receitas e despesas → todos os 3 cards preenchidos
- `CT-002.2`: Mês sem transações → todos os cards em R$ 0,00
- `CT-002.3`: Saldo negativo → card saldo em vermelho

---

## 3. Requisitos Não-Funcionais

### NFR-001: Performance

**Descrição:** O relatório deve carregar em menos de 2 segundos para até 1000 transações.
**Métrica:** Tempo de resposta da API < 2000ms no P95.
**Prioridade:** Alta

---

## 4. Dependências

- API `GET /api/reports/monthly?month={M}&year={Y}`
- Componente `SummaryCards` já existente

---

## Histórico de Revisões

| Versão | Data | Autor | Mudanças |
|--------|------|-------|----------|
| 1.0.0 | 2026-05-13 | Nexus Orquestrador | Spec inicial |
