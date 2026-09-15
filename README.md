# 427 Design

Site da **427 Design** — editora e estúdio editorial em São Paulo, especializada em projetos editoriais para arquitetura, design de interiores e paisagismo, e atuando também com revistas, catálogos e publicações corporativas para empresas de qualquer segmento.

Direção visual: *Quiet Luxury Editorial* — espaço negativo, tipografia serifada, grid assimétrico e linhas finas que remetem a plantas arquitetônicas.

---

## Stack

| | |
|---|---|
| Build | Vite 5 |
| UI | React 18 |
| Estilo | Tailwind CSS 3 |
| Roteamento | roteador por hash, próprio (~30 linhas) |
| Ícones | SVG inline, sem dependência |
| Dependências de runtime | apenas `react` e `react-dom` |

Sem backend. O checkout monta o pedido no cliente e o entrega a um único ponto de integração.

---

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
npm run preview  # serve o build
```

Requer Node 18 ou superior.

---

## Estrutura

```
.
├── index.html              # shell, metatags e fontes
├── public/
│   └── img/capas/          # onde entram as capas reais
├── src/
│   ├── App.jsx             # toda a aplicação
│   ├── main.jsx            # ponto de entrada
│   └── index.css           # camadas base/components do Tailwind
├── tailwind.config.js      # paleta, tipografia e easing
└── vite.config.js
```

`src/App.jsx` concentra dados, componentes e páginas. Os blocos de configuração ficam todos no topo do arquivo.

### Rotas

| Rota | Tela |
|---|---|
| `#/` | Home — a narrativa da editora em sete atos |
| `#/projetos` | Acervo, com filtro por categoria |
| `#/servicos` | Formatos, método e segmentos atendidos |
| `#/publicacoes` | Catálogo à venda |
| `#/publicacoes/:sku` | Página do título |
| `#/checkout` | Dados, endereço, frete e pagamento |
| `#/pedido` | Confirmação |
| `#/sobre` | A editora e Antonio Baldini |
| `#/contato` | Formulário e contatos diretos |

O roteador por hash faz o site funcionar em hospedagem estática sem nenhuma regra de rewrite — inclusive no GitHub Pages. Para migrar a URLs limpas, troque `useRouter` por `react-router-dom` e configure o fallback para `index.html` no servidor.

---

## O que precisa ser configurado

Três blocos no topo de `src/App.jsx`.

### 1. Imagens

Nenhuma fotografia foi inventada. Enquanto não há arquivos reais, cada projeto renderiza como um objeto-livro tipográfico — lombada, proporção de livro e título composto — e o retrato do fundador aparece como moldura reservada.

```js
ASSETS.projetos['deborah-roig'] = '/img/capas/deborah-roig.jpg';
ASSETS.retratoAntonio           = '/img/antonio-baldini.jpg';
ASSETS.hero                     = '/img/hero.jpg';
```

A chave é o `slug` do projeto no array `PROJETOS`. Proporção recomendada: 3:4.

### 2. Pagamento

O gateway ainda não foi escolhido. Todo o fluxo desemboca numa função só:

```js
const CONFIG = { gateway: null };  // 'mercadopago' | 'stripe' | 'pagarme'

async function iniciarPagamento(pedido) { /* ... */ }
```

O objeto `pedido` sai pronto, com itens, cliente, entrega (modalidade, prazo, valor), método escolhido e os totais. Para Mercado Pago ou Stripe, o padrão é um `POST` ao seu backend devolvendo a URL de redirect:

```js
const r = await fetch(import.meta.env.VITE_API_PAGAMENTO, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(pedido),
});
const { url } = await r.json();
window.location.href = url;
return { redirecionado: true };
```

**Chaves secretas nunca entram no front-end.** Elas ficam no backend ou na serverless function; veja `.env.example`. Enquanto `CONFIG.gateway` for `null`, o pedido é registrado e o cliente segue para a confirmação — a editora já consegue vender.

### 3. Frete

O cálculo por CEP roda offline, a partir da tabela `FRETE`, mapeando o prefixo do CEP para seis zonas.

> **Os valores e prazos atuais são provisórios.** Substitua pelos praticados pela editora antes de publicar.

Para cálculo real, troque `opcoesFrete(cep, subtotal)` pela chamada ao Melhor Envio ou aos Correios — a assinatura já é compatível. Há também `CONFIG.freteGratisAcimaDe`, hoje `null`, para frete grátis a partir de um valor.

O autopreenchimento de endereço usa o ViaCEP. Se a consulta falhar, os campos ficam para digitação manual, sem erro na tela.

---

## Design

| Token | Valor | Uso |
|---|---|---|
| `ink` | `#0A0A0A` | hero, seções de contraste, rodapé |
| `paper` | `#F9F9F6` | fundo padrão |
| `sand` | `#F1EEE7` | seções alternadas |
| `rule` | `#DFDBD1` | linhas de 1px |
| `muted` | `#77736B` | texto secundário |
| `bronze` | `#8B7355` | único acento; botão de WhatsApp e microinterações |

Tipografia: **Cormorant Garamond** (300/400/500) nos títulos, **Inter** (300/400/500) em texto e interface. Labels em caixa alta com `letter-spacing` de 0.2em.

O site é monotema por decisão de projeto: um material de marca precisa ser idêntico para todo mundo. Todas as cores são explícitas, sem herança do tema do navegador.

Animações: revelação no scroll via `IntersectionObserver`, com rede de segurança de 2,6s para que nada fique invisível caso o observer não dispare, e `prefers-reduced-motion` respeitado.

---

## Acessibilidade

Foco visível em todos os controles, rótulos associados aos campos, `aria-label` nos botões de ícone, `aria-invalid` nos campos com erro, e o menu mobile e o carrinho travando o scroll do corpo enquanto abertos.

---

## Deploy

**Vercel / Netlify** — detectam o Vite sozinhos: build `npm run build`, saída `dist`.

**GitHub Pages** — publique `dist/` e ajuste em `vite.config.js`:

```js
base: '/nome-do-repositorio/',
```

---

## Pendências

- [ ] Capas reais dos projetos e retrato do Antonio Baldini
- [ ] Textos comerciais dos produtos (só o Anuário Ed. 14 tem descrição)
- [ ] Ficha técnica dos títulos: formato, páginas, acabamento
- [ ] Definir o gateway e implementar `iniciarPagamento()`
- [ ] Substituir a tabela de frete pelos valores reais
- [ ] Confirmar a classificação dos projetos de marca (Florense, Breton, Solarium, ABD)
- [ ] Imagem de Open Graph em `index.html`
