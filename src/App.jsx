import React, {
  useState, useEffect, useRef, useCallback, useMemo, createContext, useContext,
} from 'react';


/* ============================================================================
   427 DESIGN — Experiência digital
   Conceito: Quiet Luxury Editorial
   Stack: React + Tailwind CSS (single-file component)

   ---------------------------------------------------------------------------
   O QUE CONFIGURAR ANTES DE IR AO AR — tudo no topo deste arquivo
   ---------------------------------------------------------------------------
     ASSETS  → capas dos projetos, retrato do Antonio, imagem de abertura
     CONFIG  → gateway de pagamento e consulta de CEP
     FRETE   → valores e prazos reais por zona (os atuais são provisórios)

   Ícones: os SVGs em `Ico` podem ser trocados 1:1 por lucide-react.
   Rotas: roteador por hash (#/publicacoes). Para react-router, troque `useRouter`.

   ---------------------------------------------------------------------------
   COMO PLUGAR OS ATIVOS REAIS
   ---------------------------------------------------------------------------
   Todas as imagens do site passam por um único ponto: o objeto ASSETS abaixo.
   Basta apontar a chave para o caminho/URL da imagem real e ela substitui
   automaticamente a capa tipográfica provisória, em todas as telas.

       ASSETS.projetos['deborah-roig'] = '/img/capas/deborah-roig.jpg'
       ASSETS.retratoAntonio           = '/img/antonio-baldini.jpg'
       ASSETS.hero                     = '/img/hero.jpg'

   Nenhuma fotografia foi inventada. Onde não há ativo real, a estrutura
   renderiza um objeto editorial tipográfico — desenhado para ser bonito
   enquanto o banco de imagens não entra.
   ============================================================================ */

/* ---------------------------------------------------------------- ATIVOS -- */

const ASSETS = {
  hero: null,            // fotografia de abertura (opcional, sobre o fundo escuro)
  retratoAntonio: null,  // fotografia profissional do Antonio Baldini
  oficina: null,         // imagem de processo / produção gráfica
  projetos: {},          // { 'slug-do-projeto': '/caminho/da/capa.jpg' }
};

/* ---------------------------------------------------------------- MARCA --- */

const CONTATO = {
  telefone: '+55 11 94520-1015',
  whatsapp: '5511945201015',
  email: 'antonio@427design.com.br',
  instagram: '427_design',
  instagramUrl: 'https://instagram.com/427_design',
  cidade: 'São Paulo · Brasil',
};

const MSG_PADRAO =
  'Olá! Conheci a 427 Design pelo site e gostaria de saber mais sobre os projetos editoriais.';

const waLink = (msg = MSG_PADRAO) =>
  `https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent(msg)}`;

/* --------------------------------------------------------- CHECKOUT ------ */
/*
   PAGAMENTO — ponto único de integração
   -------------------------------------
   O gateway ainda não foi definido. Todo o checkout já monta o objeto do
   pedido; só falta ligar o provedor em `iniciarPagamento()` mais abaixo.
   Basta trocar CONFIG.gateway e implementar o ramo correspondente:

     'mercadopago' → POST /api/pagamento → { init_point } → redirect
     'stripe'      → POST /api/pagamento → { url }        → redirect
     'pagarme'     → checkout transparente no próprio site

   Enquanto CONFIG.gateway for null, o pedido é registrado e o cliente é
   levado à tela de confirmação, com o resumo e o contato da editora.

   FRETE
   -----
   O cálculo por CEP roda offline, a partir da tabela FRETE abaixo.
   >>> Os valores e prazos são PROVISÓRIOS: substituir pelos praticados
   >>> pela editora, ou trocar `opcoesFrete()` pela API do Melhor Envio
   >>> / Correios (a assinatura da função já é compatível).
*/

const CONFIG = {
  gateway: null,          // 'mercadopago' | 'stripe' | 'pagarme' | null
  consultarCepOnline: true, // autopreenchimento de endereço via ViaCEP
  freteGratisAcimaDe: null, // ex.: 800 para frete grátis acima de R$ 800
};

/* Zonas por prefixo de CEP (2 primeiros dígitos). */
const ZONAS_CEP = [
  { ate: 9,  zona: 'Capital — São Paulo' },
  { ate: 19, zona: 'Interior de São Paulo' },
  { ate: 39, zona: 'Sudeste' },
  { ate: 69, zona: 'Norte e Nordeste' },
  { ate: 79, zona: 'Centro-Oeste' },
  { ate: 99, zona: 'Sul' },
];

/* Valores provisórios — confirmar com a editora. */
const FRETE = {
  'Capital — São Paulo':   [{ id: 'eco', nome: 'Econômico', prazo: '3 a 5 dias úteis', preco: 24.9 }, { id: 'exp', nome: 'Expresso', prazo: '1 dia útil', preco: 39.9 }],
  'Interior de São Paulo': [{ id: 'eco', nome: 'Econômico', prazo: '4 a 7 dias úteis', preco: 29.9 }, { id: 'exp', nome: 'Expresso', prazo: '2 dias úteis', preco: 49.9 }],
  'Sudeste':               [{ id: 'eco', nome: 'Econômico', prazo: '5 a 9 dias úteis', preco: 36.9 }, { id: 'exp', nome: 'Expresso', prazo: '2 a 3 dias úteis', preco: 59.9 }],
  'Sul':                   [{ id: 'eco', nome: 'Econômico', prazo: '6 a 10 dias úteis', preco: 42.9 }, { id: 'exp', nome: 'Expresso', prazo: '3 dias úteis', preco: 69.9 }],
  'Centro-Oeste':          [{ id: 'eco', nome: 'Econômico', prazo: '7 a 12 dias úteis', preco: 46.9 }, { id: 'exp', nome: 'Expresso', prazo: '3 a 4 dias úteis', preco: 74.9 }],
  'Norte e Nordeste':      [{ id: 'eco', nome: 'Econômico', prazo: '9 a 15 dias úteis', preco: 54.9 }, { id: 'exp', nome: 'Expresso', prazo: '4 a 6 dias úteis', preco: 89.9 }],
};

const soDigitos = (v) => (v || '').replace(/\D/g, '');

function zonaPorCep(cep) {
  const d = soDigitos(cep);
  if (d.length !== 8) return null;
  const pref = parseInt(d.slice(0, 2), 10);
  const faixa = ZONAS_CEP.find((z) => pref <= z.ate);
  return faixa ? faixa.zona : null;
}

/* Mesma assinatura de uma chamada real ao Melhor Envio / Correios. */
function opcoesFrete(cep, subtotal) {
  const zona = zonaPorCep(cep);
  if (!zona) return null;
  const base = FRETE[zona] || [];
  const gratis = CONFIG.freteGratisAcimaDe && subtotal >= CONFIG.freteGratisAcimaDe;
  return { zona, opcoes: base.map((o) => ({ ...o, preco: gratis ? 0 : o.preco })) };
}

/* Autopreenchimento de endereço. Se a consulta não estiver disponível,
   o cliente simplesmente digita o endereço — sem erro na tela. */
async function buscarCep(cep) {
  if (!CONFIG.consultarCepOnline) return null;
  const d = soDigitos(cep);
  if (d.length !== 8) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.erro) return null;
    return { logradouro: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '' };
  } catch (e) {
    return null;
  }
}

/* CPF com validação real dos dígitos verificadores. */
function cpfValido(v) {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(c[i], 10) * (10 - i);
  let d1 = (soma * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9], 10)) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(c[i], 10) * (11 - i);
  let d2 = (soma * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10], 10);
}

const mascaraCep = (v) => { const d = soDigitos(v).slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const mascaraCpf = (v) => soDigitos(v).slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
const mascaraTel = (v) => { const d = soDigitos(v).slice(0, 11); if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2'); return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2'); };

const METODOS = [
  { id: 'pix', nome: 'Pix', nota: 'Aprovação imediata' },
  { id: 'cartao', nome: 'Cartão de crédito', nota: 'Parcelamento conforme o gateway' },
  { id: 'boleto', nome: 'Boleto bancário', nota: 'Compensação em até 3 dias úteis' },
];

/* Último pedido concluído — lido pela tela de confirmação. */
let ULTIMO_PEDIDO = null;
function guardarPedido(p) {
  ULTIMO_PEDIDO = p;
  try { window.sessionStorage.setItem('427:pedido', JSON.stringify(p)); } catch (e) { /* sessão anônima */ }
}
function lerPedido() {
  if (ULTIMO_PEDIDO) return ULTIMO_PEDIDO;
  try { const r = window.sessionStorage.getItem('427:pedido'); return r ? JSON.parse(r) : null; } catch (e) { return null; }
}

/* ---- PONTO ÚNICO DE INTEGRAÇÃO DO GATEWAY ---- */
async function iniciarPagamento(pedido) {
  switch (CONFIG.gateway) {
    case 'mercadopago':
    case 'stripe': {
      // const r = await fetch('/api/pagamento', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(pedido),
      // });
      // const { url } = await r.json();
      // window.location.href = url;
      // return { redirecionado: true };
      return { redirecionado: false, motivo: 'endpoint-nao-configurado' };
    }
    case 'pagarme':
      return { redirecionado: false, motivo: 'checkout-transparente-nao-configurado' };
    default:
      /* Sem gateway: o pedido é registrado e segue para confirmação. */
      return { redirecionado: false, motivo: 'sem-gateway' };
  }
}

/* ------------------------------------------------------------- PROJETOS --- */
/* Projetos reais identificados no acervo publicado pela 427 Design.
   `tom` define a paleta da capa tipográfica provisória (substituída pelo
   ativo real assim que ASSETS.projetos[slug] for preenchido).            */

const PROJETOS = [
  { slug: 'stock-home-office-14', titulo: 'Stock Home & Office', linha: 'Edição 14', autor: 'Anuário de decoração', categoria: 'Anuário', tom: 'paper' },
  { slug: 'deborah-roig', titulo: 'Deborah Roig', linha: 'Arquitetura', autor: 'Arquiteta Deborah Roig', categoria: 'Arquitetura', tom: 'wood' },
  { slug: 'fernanda-marques', titulo: 'Fernanda Marques', linha: 'Arquitetura', autor: 'Arquiteta Fernanda Marques', categoria: 'Arquitetura', tom: 'stone' },
  { slug: 'rogerio-perez', titulo: 'Rogério Perez', linha: 'Arquitetura e Construção', autor: 'Rogério Perez', categoria: 'Arquitetura', tom: 'paper' },
  { slug: 'negrelli-teixeira', titulo: 'Negrelli & Teixeira', linha: 'Escritório de arquitetura', autor: 'Negrelli & Teixeira', categoria: 'Arquitetura', tom: 'ink' },
  { slug: 'mw-arq', titulo: 'MW ARQ', linha: 'Arquitetura', autor: 'Arquiteta Moema Wertheimer', categoria: 'Arquitetura', tom: 'graphite' },
  { slug: 'roberta-trida', titulo: 'Roberta Trida', linha: 'Arquitetura', autor: 'Arquiteta Roberta Trida', categoria: 'Arquitetura', tom: 'stone' },
  { slug: 'viviane-gobbato', titulo: 'Viviane Gobbato', linha: 'Arquitetura', autor: 'Arquiteta Viviane Gobbato', categoria: 'Arquitetura', tom: 'clay' },
  { slug: 'simone-meirelles', titulo: 'Simone Meirelles', linha: 'Arquitetura', autor: 'Simone Meirelles', categoria: 'Arquitetura', tom: 'wood' },
  { slug: 'stock-home-office-12', titulo: 'Stock Home & Office', linha: 'Volume 12', autor: 'Anuário de decoração', categoria: 'Anuário', tom: 'graphite' },
  { slug: 'contemporanea-magazine', titulo: 'Contemporânea', linha: 'Magazine', autor: 'Revista', categoria: 'Revista', tom: 'paper' },
  { slug: 'erica-salguero', titulo: 'Érica Salguero', linha: 'Contemporânea Magazine', autor: 'Capa de revista', categoria: 'Revista', tom: 'clay' },
  { slug: 'camila-klein', titulo: 'Camila Klein', linha: 'Contemporânea Magazine', autor: 'Capa de revista', categoria: 'Revista', tom: 'ink' },
  { slug: 'florense', titulo: 'Florense', linha: 'Publicação de marca', autor: 'Projeto institucional', categoria: 'Marcas e empresas', tom: 'stone' },
  { slug: 'breton', titulo: 'Breton', linha: 'Publicação de marca', autor: 'Projeto institucional', categoria: 'Marcas e empresas', tom: 'wood' },
  { slug: 'solarium', titulo: 'Solarium', linha: 'Publicação de marca', autor: 'Projeto institucional', categoria: 'Marcas e empresas', tom: 'clay' },
  { slug: 'abd', titulo: 'ABD', linha: 'Publicação institucional', autor: 'Projeto institucional', categoria: 'Marcas e empresas', tom: 'graphite' },
  { slug: 'fmaa', titulo: 'FMAA', linha: 'Arquitetura', autor: 'Escritório de arquitetura', categoria: 'Arquitetura', tom: 'paper' },
];

const CATEGORIAS = ['Todos', 'Arquitetura', 'Revista', 'Anuário', 'Marcas e empresas'];

/* ------------------------------------------------------------- PRODUTOS --- */
/* Catálogo real, com os preços praticados hoje pela editora.
   `descricao: null` = texto comercial ainda não fornecido pelo cliente.   */

const PRODUTOS = [
  {
    slug: 'stock-home-office-14', sku: '427-AN-14',
    titulo: 'Anuário de decoração Stock Home & Office', linha: 'Edição 14',
    preco: 350, categoria: 'Anuários',
    descricao:
      'Uma celebração do design de interiores. Explore tendências, projetos inspiradores e inovações em apenas uma edição. Seja inspirado e transforme seus espaços com estilo e funcionalidade.',
  },
  { slug: 'deborah-roig-2', sku: '427-LV-01', titulo: 'Livro Arquiteta Deborah Roig', linha: 'Edição especial', preco: 550, categoria: 'Livros', descricao: null },
  { slug: 'roberta-trida', sku: '427-LV-02', titulo: 'Livro Arquiteta Roberta Trida', linha: 'Arquitetura', preco: 320, categoria: 'Livros', descricao: null },
  { slug: 'viviane-gobbato', sku: '427-LV-03', titulo: 'Livro Arquiteta Viviane Gobbato', linha: 'Arquitetura', preco: 350, categoria: 'Livros', descricao: null },
  { slug: 'stock-home-office-12', sku: '427-AN-12', titulo: 'Anuário de decoração Stock Home & Office', linha: 'Volume 12', preco: 290, categoria: 'Anuários', descricao: null },
  { slug: 'rogerio-perez', sku: '427-LV-04', titulo: 'Livro Rogério Perez Arquitetura e Construção', linha: 'Arquitetura e construção', preco: 290, categoria: 'Livros', descricao: null },
  { slug: 'negrelli-teixeira', sku: '427-LV-05', titulo: 'Livro Escritório Negrelli & Teixeira', linha: 'Escritório de arquitetura', preco: 250, categoria: 'Livros', descricao: null },
  { slug: 'fernanda-marques', sku: '427-LV-06', titulo: 'Livro Fernanda Marques Arquitetura', linha: 'Arquitetura', preco: 280, categoria: 'Livros', descricao: null },
  { slug: 'mw-arq', sku: '427-LV-07', titulo: 'Livro MW ARQ — Arquiteta Moema Wertheimer', linha: 'Arquitetura', preco: 290, categoria: 'Livros', descricao: null },
  { slug: 'deborah-roig', sku: '427-LV-08', titulo: 'Livro Arquiteta Deborah Roig', linha: 'Arquitetura', preco: 290, categoria: 'Livros', descricao: null },
];

const CAT_LOJA = ['Todas', 'Livros', 'Anuários'];

/* ------------------------------------------------------------- SERVIÇOS --- */

const PROCESSO = [
  { n: '01', titulo: 'Conceito e projeto editorial', texto: 'Definimos o que a publicação precisa ser: recorte, narrativa, formato, número de páginas e o lugar que ela vai ocupar na estratégia da marca ou da carreira.' },
  { n: '02', titulo: 'Conteúdo e direção de arte', texto: 'Curadoria do acervo, produção de texto, pauta fotográfica e direção de arte. É aqui que o material bruto vira um livro com ponto de vista.' },
  { n: '03', titulo: 'Design e diagramação', texto: 'Grid, tipografia, ritmo de página e tratamento de imagem. Cada virada de página é composta — não preenchida.' },
  { n: '04', titulo: 'Produção gráfica e impressão', texto: 'Papel, acabamento, prova de cor e acompanhamento de máquina. O objeto impresso é o produto final, e ele é tratado como tal.' },
];

const FORMATOS = [
  { titulo: 'Livros', texto: 'Monografias de escritório, livros de portfólio, livros comemorativos e edições de autor.' },
  { titulo: 'Revistas', texto: 'Publicações periódicas, magazines de marca e edições especiais com projeto gráfico próprio.' },
  { titulo: 'Catálogos', texto: 'Catálogos de produto, coleção e linha, com direção de arte e produção fotográfica.' },
  { titulo: 'Publicações corporativas', texto: 'Livros institucionais, publicações de aniversário, relatórios e materiais de relacionamento.' },
  { titulo: 'Materiais impressos', texto: 'Peças gráficas, embalagens e materiais promocionais desenvolvidos sob o mesmo rigor editorial.' },
];

const VANTAGENS = [
  'Divulgação do seu trabalho reconhecido para uma maior quantidade de clientes potenciais.',
  'Fidelização da sua marca no seu segmento de atuação.',
  'Destaque ao apresentar um portfólio exclusivo, consolidando sua carreira em um produto único.',
];

/* =========================================================== UTILITÁRIOS === */

/* Hooks já importados no topo do arquivo. */

const brl = (n) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

/* Router por hash — funciona em hospedagem estática e em preview. */
function useRouter() {
  const parse = () => (window.location.hash || '#/').replace(/^#/, '') || '/';
  const [path, setPath] = useState(parse);
  useEffect(() => {
    const on = () => setPath(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((to) => {
    if (('#' + to) === window.location.hash) return;
    window.location.hash = to;
    window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  return [path, go];
}

/* Revelação no scroll — sutil, uma vez só, respeitando prefers-reduced-motion. */
function useReveal(options) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('is-in'); io.unobserve(el); } },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px', ...(options || {}) }
    );
    io.observe(el);
    /* Rede de segurança: nada pode ficar invisível se o observer não disparar. */
    const t = setTimeout(() => el.classList.add('is-in'), 2600);
    return () => { clearTimeout(t); io.disconnect(); };
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, as: Tag = 'div', className = '' }) {
  const ref = useReveal();
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/* ============================================================== ÍCONES ==== */
/* SVG inline: zero dependência externa. Em projeto próprio, podem ser
   substituídos 1:1 por lucide-react (Menu, X, ShoppingBag, ArrowRight...).  */

const Ico = {
  menu: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><path d="M3 7h18M3 17h18" /></svg>),
  x: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><path d="M5 5l14 14M19 5L5 19" /></svg>),
  bag: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><path d="M4 7h16l-1.2 13H5.2L4 7Z" /><path d="M8.5 7V5.6A3.5 3.5 0 0 1 12 2.1a3.5 3.5 0 0 1 3.5 3.5V7" /></svg>),
  arrow: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><path d="M4 12h15M13 6l6 6-6 6" /></svg>),
  arrowUpRight: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><path d="M7 17 17 7M8 7h9v9" /></svg>),
  minus: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><path d="M5 12h14" /></svg>),
  plus: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><path d="M12 5v14M5 12h14" /></svg>),
  mail: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></svg>),
  instagram: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" /></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><path d="m4 12.5 5.2 5.2L20 7" /></svg>),
  lock: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" {...p}><rect x="4.5" y="10" width="15" height="10.5" rx="1" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>),
  whatsapp: (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 1.82c2.16 0 4.19.84 5.72 2.37a8.03 8.03 0 0 1 2.37 5.72c0 4.46-3.63 8.09-8.1 8.09a8.2 8.2 0 0 1-4.13-1.13l-.3-.18-3.07.81.82-3-.19-.31a8.02 8.02 0 0 1-1.26-4.29c0-4.46 3.63-8.08 8.14-8.08Zm-2.6 4.09c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02 0 1.19.87 2.34.99 2.5.12.16 1.7 2.6 4.13 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.43-.59 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28-.24-.12-1.43-.71-1.65-.79-.22-.08-.38-.12-.54.12-.16.24-.62.79-.76.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.31-.74-1.79-.19-.46-.39-.4-.54-.41h-.46Z" /></svg>),
};

function Icon({ name, size = 20, className = '' }) {
  const C = Ico[name];
  return <C width={size} height={size} className={className} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" />;
}

/* ============================================================== ÁTOMOS ==== */

function Label({ children, className = '', dark = false }) {
  return (
    <span className={`block font-ui text-[10px] md:text-[11px] uppercase tracking-[0.22em] ${dark ? 'text-bronze-300' : 'text-bronze'} ${className}`}>
      {children}
    </span>
  );
}

function Rule({ className = '', dark = false }) {
  return <div className={`h-px w-full ${dark ? 'bg-white/12' : 'bg-rule'} ${className}`} />;
}

/* Botão editorial: texto em caixa alta com sublinhado que cresce no hover. */
function LinkBtn({ children, href, onClick, dark = false, className = '', external = false }) {
  const cls = `group inline-flex items-center gap-3 font-ui text-[11px] uppercase tracking-[0.2em] ${dark ? 'text-paper' : 'text-ink'} ${className}`;
  const inner = (
    <>
      <span className="relative pb-1">
        {children}
        <span className={`absolute bottom-0 left-0 h-px w-full origin-left scale-x-100 ${dark ? 'bg-white/30' : 'bg-ink/25'}`} />
        <span className={`absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 transition-transform duration-500 ease-editorial group-hover:scale-x-100 ${dark ? 'bg-bronze-300' : 'bg-bronze'}`} />
      </span>
      <Icon name="arrow" size={15} className="translate-x-0 transition-transform duration-500 ease-editorial group-hover:translate-x-1.5" />
    </>
  );
  if (href) return <a href={href} onClick={onClick} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{inner}</a>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

/* Botão sólido, usado com parcimônia. */
function SolidBtn({ children, href, onClick, type = 'button', dark = false, full = false, external = false, className = '' }) {
  const cls = `inline-flex items-center justify-center gap-2.5 px-8 py-4 font-ui text-[11px] uppercase tracking-[0.2em] transition-colors duration-400 ease-editorial ${full ? 'w-full' : ''} ${dark ? 'bg-paper text-ink hover:bg-bronze-300' : 'bg-ink text-paper hover:bg-bronze'} ${className}`;
  if (href) return <a href={href} className={cls} onClick={onClick} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
  return <button type={type} onClick={onClick} className={cls}>{children}</button>;
}

/* ------------------------------------------------------------- A CAPA ----- */
/* O objeto mais importante do site. Renderiza a imagem real quando ela
   existe; caso contrário, compõe uma capa tipográfica com lombada,
   proporção de livro e leve profundidade. Hover: inclinação 3D discreta. */

const TONS = {
  ink:      { bg: '#12120F', fg: '#F2EFE7', lombada: '#000000', linha: 'rgba(242,239,231,.28)' },
  graphite: { bg: '#2E2E2B', fg: '#EDEAE1', lombada: '#1C1C1A', linha: 'rgba(237,234,225,.26)' },
  stone:    { bg: '#D9D5CB', fg: '#22221F', lombada: '#C2BDB1', linha: 'rgba(34,34,31,.22)' },
  paper:    { bg: '#EFEBE1', fg: '#22221F', lombada: '#DED9CC', linha: 'rgba(34,34,31,.2)' },
  clay:     { bg: '#B08767', fg: '#1E1A16', lombada: '#98704F', linha: 'rgba(30,26,22,.24)' },
  wood:     { bg: '#7A5A41', fg: '#F2EBE1', lombada: '#61452F', linha: 'rgba(242,235,225,.26)' },
};

function Capa({ item, ratio = '3 / 4', priority = false, className = '' }) {
  const src = ASSETS.projetos[item.slug] || null;
  const t = TONS[item.tom] || TONS.paper;
  return (
    <div className={`capa group/capa relative ${className}`} style={{ aspectRatio: ratio }}>
      <div className="capa-inner relative h-full w-full">
        {src ? (
          <img
            src={src}
            alt={`Capa — ${item.titulo}`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="capa-fig relative flex h-full w-full flex-col justify-between overflow-hidden p-[7%]" style={{ background: t.bg, color: t.fg }}>
            {/* lombada */}
            <div className="absolute inset-y-0 left-0 w-[3.5%]" style={{ background: t.lombada }} />
            <div className="absolute inset-y-0 left-[3.5%] w-px" style={{ background: t.linha }} />
            <div className="pl-[6%]">
              <div className="capa-marca font-ui uppercase tracking-[0.28em] opacity-70">427</div>
            </div>
            <div className="pl-[6%]">
              <div className="mb-[8%] h-px w-[38%]" style={{ background: t.linha }} />
              <div className="capa-titulo font-display font-light tracking-[-0.01em]">
                {item.titulo}
              </div>
              {item.linha && (
                <div className="capa-linha mt-[4%] font-ui uppercase tracking-[0.22em] opacity-65">
                  {item.linha}
                </div>
              )}
            </div>
          </div>
        )}
        {/* brilho de superfície */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 ease-editorial group-hover/capa:opacity-100"
             style={{ background: 'linear-gradient(105deg, rgba(255,255,255,0) 42%, rgba(255,255,255,.1) 50%, rgba(255,255,255,0) 58%)' }} />
      </div>
    </div>
  );
}

/* Moldura preparada para fotografia real ainda não fornecida. */
function MolduraFoto({ src, alt, legenda, ratio = '4 / 5', className = '' }) {
  if (src) {
    return (
      <figure className={className}>
        <div style={{ aspectRatio: ratio }} className="overflow-hidden bg-sand">
          <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </div>
        {legenda && <figcaption className="mt-4 font-ui text-[10px] uppercase tracking-[0.2em] text-muted">{legenda}</figcaption>}
      </figure>
    );
  }
  return (
    <figure className={className}>
      <div style={{ aspectRatio: ratio }} className="relative flex items-end overflow-hidden border border-rule bg-sand p-8">
        <div className="pointer-events-none absolute inset-6 border border-rule/70" />
        <div className="relative">
          <div className="mb-3 h-px w-10 bg-bronze/50" />
          <div className="font-ui text-[10px] uppercase tracking-[0.22em] text-muted">
            Espaço reservado<br />para fotografia
          </div>
        </div>
      </div>
      {legenda && <figcaption className="mt-4 font-ui text-[10px] uppercase tracking-[0.2em] text-muted">{legenda}</figcaption>}
    </figure>
  );
}

/* ========================================================== CARRINHO ====== */

const CarrinhoCtx = createContext(null);
const useCarrinho = () => useContext(CarrinhoCtx);

function CarrinhoProvider({ children }) {
  const [itens, setItens] = useState(() => {
    try {
      const raw = window.localStorage.getItem('427:carrinho');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  });
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem('427:carrinho', JSON.stringify(itens)); } catch (e) { /* sessão anônima */ }
  }, [itens]);

  const adicionar = useCallback((produto, qtd = 1) => {
    setItens((prev) => {
      const i = prev.findIndex((x) => x.sku === produto.sku);
      if (i > -1) {
        const cp = [...prev];
        cp[i] = { ...cp[i], qtd: cp[i].qtd + qtd };
        return cp;
      }
      return [...prev, { sku: produto.sku, slug: produto.slug, titulo: produto.titulo, linha: produto.linha, preco: produto.preco, qtd }];
    });
    setAberto(true);
  }, []);

  const alterar = useCallback((sku, delta) => {
    setItens((prev) => prev.flatMap((x) => {
      if (x.sku !== sku) return [x];
      const q = x.qtd + delta;
      return q <= 0 ? [] : [{ ...x, qtd: q }];
    }));
  }, []);

  const remover = useCallback((sku) => setItens((prev) => prev.filter((x) => x.sku !== sku)), []);
  const limpar = useCallback(() => setItens([]), []);

  const total = useMemo(() => itens.reduce((s, x) => s + x.preco * x.qtd, 0), [itens]);
  const quantidade = useMemo(() => itens.reduce((s, x) => s + x.qtd, 0), [itens]);

  const value = { itens, total, quantidade, adicionar, alterar, remover, limpar, aberto, setAberto };
  return <CarrinhoCtx.Provider value={value}>{children}</CarrinhoCtx.Provider>;
}

function CarrinhoDrawer() {
  const { itens, total, alterar, remover, aberto, setAberto } = useCarrinho();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = aberto ? 'hidden' : '';
    return () => { document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = ''; };
  }, [aberto]);

  return (
    <>
      <div
        onClick={() => setAberto(false)}
        className={`fixed inset-0 z-[70] bg-ink/40 backdrop-blur-[2px] transition-opacity duration-500 ease-editorial ${aberto ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label="Carrinho"
        aria-hidden={!aberto}
        className={`fixed right-0 top-0 z-[71] flex h-[100dvh] w-full max-w-[26rem] flex-col bg-paper transition-transform duration-600 ease-editorial ${aberto ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <header className="flex items-center justify-between px-6 py-6 md:px-8">
          <Label>Carrinho{itens.length > 0 ? ` · ${itens.length}` : ''}</Label>
          <button onClick={() => setAberto(false)} aria-label="Fechar carrinho" className="-mr-2 p-2 text-ink/60 transition-colors hover:text-ink">
            <Icon name="x" size={20} />
          </button>
        </header>
        <Rule />

        {itens.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-5 h-px w-8 bg-bronze/50" />
            <p className="font-display text-2xl font-light text-ink">Seu carrinho está vazio.</p>
            <p className="mt-3 max-w-[22ch] font-ui text-sm leading-relaxed text-muted">
              Conheça as publicações disponíveis no catálogo da editora.
            </p>
            <div className="mt-8">
              <LinkBtn href="#/publicacoes" onClick={() => setAberto(false)}>Ver publicações</LinkBtn>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 md:px-8">
              {itens.map((x) => {
                const proj = capaDoProduto(x);
                return (
                  <div key={x.sku} className="flex gap-5 border-b border-rule py-6">
                    <div className="w-20 shrink-0"><Capa item={proj} /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-light leading-tight text-ink">{x.titulo}</h3>
                      {x.linha && <p className="mt-1 font-ui text-[10px] uppercase tracking-[0.18em] text-muted">{x.linha}</p>}
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center border border-rule">
                          <button onClick={() => alterar(x.sku, -1)} aria-label="Diminuir" className="px-2.5 py-2 text-ink/60 transition-colors hover:text-ink"><Icon name="minus" size={13} /></button>
                          <span className="min-w-[1.75rem] text-center font-ui text-xs tabular-nums text-ink">{x.qtd}</span>
                          <button onClick={() => alterar(x.sku, 1)} aria-label="Aumentar" className="px-2.5 py-2 text-ink/60 transition-colors hover:text-ink"><Icon name="plus" size={13} /></button>
                        </div>
                        <span className="font-ui text-sm tabular-nums text-ink">{brl(x.preco * x.qtd)}</span>
                      </div>
                      <button onClick={() => remover(x.sku)} className="mt-3 font-ui text-[10px] uppercase tracking-[0.18em] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline">
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-rule px-6 py-6 md:px-8">
              <div className="flex items-baseline justify-between">
                <Label>Subtotal</Label>
                <span className="font-display text-2xl font-light tabular-nums text-ink">{brl(total)}</span>
              </div>
              <p className="mt-2 font-ui text-[11px] leading-relaxed text-muted">
                Frete e prazo de entrega calculados na finalização.
              </p>
              <SolidBtn href="#/checkout" onClick={() => setAberto(false)} full className="mt-5">
                Finalizar pedido
              </SolidBtn>
              <button onClick={() => setAberto(false)} className="mt-4 w-full font-ui text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-ink">
                Continuar navegando
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

/* ========================================================= NAVEGAÇÃO ===== */

const MENU = [
  { label: 'Projetos', to: '/projetos' },
  { label: 'Serviços', to: '/servicos' },
  { label: 'Publicações', to: '/publicacoes' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Contato', to: '/contato' },
];

function Logo({ dark = false, className = '' }) {
  return (
    <span className={`flex items-baseline gap-2 ${className}`}>
      <span className={`font-display text-[1.6rem] font-light leading-none tracking-[0.02em] md:text-[1.75rem] ${dark ? 'text-paper' : 'text-ink'}`}>427</span>
      <span className={`font-ui text-[9px] uppercase tracking-[0.32em] ${dark ? 'text-paper/55' : 'text-ink/50'} md:text-[10px]`}>Design</span>
    </span>
  );
}

function Nav({ path, go, transparente }) {
  const [rolou, setRolou] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const { quantidade, setAberto } = useCarrinho();

  useEffect(() => {
    const on = () => setRolou(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  /* Ao mudar de página, menu e carrinho se fecham. */
  useEffect(() => { setMenuAberto(false); setAberto(false); }, [path]);
  useEffect(() => {
    document.documentElement.style.overflow = menuAberto ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [menuAberto]);

  const claro = transparente && !rolou && !menuAberto;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-[60] transition-[background-color,border-color,padding] duration-600 ease-editorial ${
          claro ? 'border-b border-transparent bg-transparent py-6 md:py-8' : 'border-b border-rule bg-paper/92 py-4 backdrop-blur-md md:py-5'
        }`}
      >
        <div className="mx-auto flex max-w-[92rem] items-center justify-between gap-6 px-6 md:px-10 lg:px-14">
          <a href="#/" aria-label="427 Design — início" className="shrink-0">
            <Logo dark={claro} />
          </a>

          <nav className="hidden items-center gap-9 lg:flex" aria-label="Principal">
            {MENU.map((m) => {
              const ativo = path === m.to || (m.to !== '/' && path.startsWith(m.to));
              return (
                <a
                  key={m.to}
                  href={'#' + m.to}
                  className={`group relative font-ui text-[11px] uppercase tracking-[0.2em] transition-colors duration-400 ${
                    claro ? 'text-paper/75 hover:text-paper' : 'text-ink/65 hover:text-ink'
                  } ${ativo ? (claro ? '!text-paper' : '!text-ink') : ''}`}
                >
                  {m.label}
                  <span className={`absolute -bottom-1.5 left-0 h-px w-full origin-left transition-transform duration-500 ease-editorial ${ativo ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'} ${claro ? 'bg-bronze-300' : 'bg-bronze'}`} />
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 md:gap-4">
            <button
              onClick={() => setAberto(true)}
              aria-label={`Carrinho, ${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`}
              className={`relative p-2 transition-colors duration-400 ${claro ? 'text-paper/80 hover:text-paper' : 'text-ink/70 hover:text-ink'}`}
            >
              <Icon name="bag" size={19} />
              {quantidade > 0 && (
                <span className="absolute right-0 top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-bronze px-1 font-ui text-[9px] font-medium tabular-nums text-paper">
                  {quantidade}
                </span>
              )}
            </button>
            <button
              onClick={() => setMenuAberto((v) => !v)}
              aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuAberto}
              className={`-mr-2 p-2 transition-colors duration-400 lg:hidden ${claro ? 'text-paper' : 'text-ink'}`}
            >
              <Icon name={menuAberto ? 'x' : 'menu'} size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Menu mobile — sobreposição integral, tipografia grande */}
      <div
        className={`fixed inset-0 z-[55] bg-ink transition-[opacity,visibility] duration-500 ease-editorial lg:hidden ${
          menuAberto ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div className="flex h-[100dvh] flex-col px-6 pb-10 pt-28">
          <nav className="flex-1" aria-label="Menu mobile">
            {MENU.map((m, i) => (
              <a
                key={m.to}
                href={'#' + m.to}
                className="group block border-b border-white/10 py-5"
                style={{ transition: 'opacity .6s var(--ease), transform .6s var(--ease)', transitionDelay: `${menuAberto ? 120 + i * 55 : 0}ms`, opacity: menuAberto ? 1 : 0, transform: menuAberto ? 'none' : 'translateY(14px)' }}
              >
                <span className="flex items-center justify-between gap-4">
                  <span className="font-display text-[2rem] font-light leading-none text-paper sm:text-[2.4rem]">{m.label}</span>
                  <Icon name="arrow" size={17} className="text-bronze-300 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </span>
              </a>
            ))}
          </nav>
          <div
            style={{ transition: 'opacity .6s var(--ease)', transitionDelay: menuAberto ? '420ms' : '0ms', opacity: menuAberto ? 1 : 0 }}
          >
            <Rule dark />
            <div className="mt-6 space-y-2">
              <a href={`mailto:${CONTATO.email}`} className="block font-ui text-sm text-paper/70 transition-colors hover:text-paper">{CONTATO.email}</a>
              <a href={waLink()} target="_blank" rel="noopener noreferrer" className="block font-ui text-sm text-paper/70 transition-colors hover:text-paper">{CONTATO.telefone}</a>
              <a href={CONTATO.instagramUrl} target="_blank" rel="noopener noreferrer" className="block font-ui text-sm text-paper/70 transition-colors hover:text-paper">@{CONTATO.instagram}</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================================================= WHATSAPP FLUTUANTE ==== */

function WhatsAppFlutuante() {
  const [visivel, setVisivel] = useState(false);
  const { aberto } = useCarrinho();

  useEffect(() => {
    const on = () => setVisivel(window.scrollY > 320);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <a
      href={waLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a 427 Design pelo WhatsApp"
      className={`fixed bottom-5 right-5 z-[65] flex items-center gap-2.5 bg-bronze text-paper shadow-[0_12px_32px_-14px_rgba(10,10,10,.6)] transition-[opacity,transform,background-color] duration-600 ease-editorial hover:bg-ink md:bottom-8 md:right-8 ${
        visivel && !aberto ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      } h-13 w-13 justify-center rounded-full md:h-auto md:w-auto md:px-6 md:py-3.5`}
    >
      <Icon name="whatsapp" size={20} className="shrink-0" />
      <span className="hidden font-ui text-[11px] uppercase tracking-[0.18em] md:inline">Fale conosco</span>
    </a>
  );
}

/* ============================================================== RODAPÉ ==== */

function Footer() {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto max-w-[92rem] px-6 pb-12 pt-20 md:px-10 md:pb-16 md:pt-28 lg:px-14">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-6">
            <h2 className="max-w-[16ch] font-display text-[clamp(2.2rem,5.2vw,4rem)] font-light leading-[1.02] tracking-[-0.015em]">
              Vamos publicar o seu projeto.
            </h2>
            <div className="mt-9">
              <LinkBtn href="#/contato" dark>Iniciar um projeto</LinkBtn>
            </div>
          </div>

          <div className="lg:col-span-3 lg:col-start-7">
            <Label dark className="mb-6">Navegação</Label>
            <ul className="space-y-3">
              {MENU.map((m) => (
                <li key={m.to}>
                  <a href={'#' + m.to} className="font-ui text-sm text-paper/60 underline-offset-4 transition-colors duration-400 hover:text-paper hover:underline">{m.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3 lg:col-start-10">
            <Label dark className="mb-6">Contato</Label>
            <ul className="space-y-3">
              <li><a href={waLink()} target="_blank" rel="noopener noreferrer" className="font-ui text-sm text-paper/60 underline-offset-4 transition-colors duration-400 hover:text-paper hover:underline">{CONTATO.telefone}</a></li>
              <li><a href={`mailto:${CONTATO.email}`} className="break-all font-ui text-sm text-paper/60 underline-offset-4 transition-colors duration-400 hover:text-paper hover:underline">{CONTATO.email}</a></li>
              <li><a href={CONTATO.instagramUrl} target="_blank" rel="noopener noreferrer" className="font-ui text-sm text-paper/60 underline-offset-4 transition-colors duration-400 hover:text-paper hover:underline">@{CONTATO.instagram}</a></li>
              <li className="pt-1 font-ui text-sm text-paper/40">{CONTATO.cidade}</li>
            </ul>
          </div>
        </div>

        <Rule dark className="mt-16 md:mt-24" />

        <div className="flex flex-col items-start justify-between gap-6 pt-7 sm:flex-row sm:items-center">
          <Logo dark />
          <p className="font-ui text-[10px] uppercase tracking-[0.2em] text-paper/35">
            © {new Date().getFullYear()} 427 Design · Todos os direitos reservados
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ====================================================== BLOCOS COMUNS ==== */

/* Cabeçalho de página interna */
function PageHead({ eyebrow, titulo, texto, children }) {
  return (
    <section className="border-b border-rule bg-paper pb-14 pt-32 md:pb-20 md:pt-44">
      <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <Label className="mb-7">{eyebrow}</Label>
              <h1 className="max-w-[18ch] font-display text-[clamp(2.6rem,7vw,5.5rem)] font-light leading-[0.98] tracking-[-0.02em] text-ink">
                {titulo}
              </h1>
            </Reveal>
          </div>
          {texto && (
            <div className="lg:col-span-4 lg:col-start-9 lg:pt-4">
              <Reveal delay={120}>
                <p className="font-ui text-[0.975rem] leading-[1.75] text-muted">{texto}</p>
                {children}
              </Reveal>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* Grade de projetos, reutilizada na Home e na página Projetos */
function GradeProjetos({ itens, onAbrir }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 md:gap-x-8 md:gap-y-16 lg:grid-cols-4">
      {itens.map((p, i) => (
        <Reveal key={p.slug} delay={(i % 4) * 90}>
          <a
            href={onAbrir ? undefined : '#/projetos'}
            onClick={onAbrir ? (e) => { e.preventDefault(); onAbrir(p); } : undefined}
            className="group block cursor-pointer"
          >
            <Capa item={p} />
            <div className="mt-5">
              <div className="h-px w-full bg-rule">
                <div className="h-px w-0 bg-bronze transition-[width] duration-700 ease-editorial group-hover:w-full" />
              </div>
              <h3 className="mt-4 font-display text-lg font-light leading-tight text-ink md:text-xl">{p.titulo}</h3>
              <p className="mt-1.5 font-ui text-[10px] uppercase tracking-[0.18em] text-muted">{p.linha}</p>
            </div>
          </a>
        </Reveal>
      ))}
    </div>
  );
}

/* =============================================================== HOME ===== */

function Hero() {
  const [pronto, setPronto] = useState(false);
  useEffect(() => { const t = setTimeout(() => setPronto(true), 80); return () => clearTimeout(t); }, []);
  const destaque = PROJETOS[0];

  const anim = (d) => ({
    opacity: pronto ? 1 : 0,
    transform: pronto ? 'none' : 'translateY(22px)',
    transition: `opacity 1.1s var(--ease) ${d}ms, transform 1.1s var(--ease) ${d}ms`,
  });

  return (
    <section className="relative flex min-h-[100svh] flex-col justify-between overflow-hidden bg-ink text-paper">
      {ASSETS.hero && (
        <div className="absolute inset-0">
          <img src={ASSETS.hero} alt="" className="h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-ink/55" />
        </div>
      )}
      {/* linhas de grid — referência a planta arquitetônica */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
        <div className="mx-auto flex h-full max-w-[92rem] justify-between px-6 md:px-10 lg:px-14">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-full w-px bg-white/[0.055]" />)}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[92rem] flex-1 px-6 pb-14 pt-32 md:px-10 md:pb-20 md:pt-40 lg:px-14">
        <div className="grid h-full grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <div style={anim(120)}>
              <Label dark className="mb-8 md:mb-10">Editora e estúdio editorial · São Paulo</Label>
            </div>
            <h1 className="font-display text-[clamp(2.9rem,8.2vw,6.75rem)] font-light leading-[0.96] tracking-[-0.025em]">
              <span className="block" style={anim(220)}>Da primeira ideia</span>
              <span className="block" style={anim(340)}>à última página.</span>
            </h1>
            <div style={anim(520)} className="mt-9 max-w-[46ch] md:mt-12">
              <p className="font-ui text-[1.0125rem] leading-[1.8] text-paper/70 md:text-[1.075rem]">
                Há mais de 25 anos produzimos livros, revistas, catálogos e publicações
                corporativas para empresas e profissionais que precisam de um objeto
                impresso à altura do próprio trabalho.
              </p>
            </div>
            <div style={anim(660)} className="mt-11 flex flex-wrap items-center gap-x-10 gap-y-5 md:mt-14">
              <LinkBtn href="#/contato" dark>Iniciar um projeto</LinkBtn>
              <LinkBtn href="#/projetos" dark>Ver projetos</LinkBtn>
            </div>
          </div>

          <div className="lg:col-span-4 lg:col-start-9">
            <div style={anim(780)} className="mx-auto w-[58%] sm:w-[42%] lg:w-full">
              <div className="hero-capa">
                <Capa item={destaque} priority />
              </div>
              <div className="mt-6 flex items-baseline gap-4">
                <div className="h-px flex-1 bg-white/15" />
                <span className="font-ui text-[10px] uppercase tracking-[0.2em] text-paper/45">
                  {destaque.titulo} · {destaque.linha}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10" style={anim(900)}>
        <div className="mx-auto flex max-w-[92rem] flex-wrap items-center justify-between gap-x-10 gap-y-3 px-6 py-5 md:px-10 lg:px-14">
          <span className="font-ui text-[10px] uppercase tracking-[0.22em] text-paper/40">
            Livros · Revistas · Catálogos · Publicações corporativas
          </span>
          <span className="font-ui text-[10px] uppercase tracking-[0.22em] text-paper/40">
            {CONTATO.cidade}
          </span>
        </div>
      </div>
    </section>
  );
}

/* Ato 2 — o que a 427 produz */
function AtoFormatos() {
  const [ativo, setAtivo] = useState(0);
  return (
    <section className="bg-paper py-24 md:py-36">
      <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <Reveal>
              <Label className="mb-7">O que produzimos</Label>
              <h2 className="max-w-[14ch] font-display text-[clamp(2.1rem,4.6vw,3.4rem)] font-light leading-[1.05] tracking-[-0.018em] text-ink">
                Um projeto editorial, do conceito ao papel.
              </h2>
              <p className="mt-7 max-w-[38ch] font-ui text-[0.95rem] leading-[1.8] text-muted">
                A 427 Design não entrega arquivos. Entrega um objeto impresso
                pensado como peça de comunicação — e produzido como tal.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-7 lg:col-start-6">
            <Reveal delay={120}>
              <Rule />
              {FORMATOS.map((f, i) => (
                <div
                  key={f.titulo}
                  onMouseEnter={() => setAtivo(i)}
                  className="group grid cursor-default grid-cols-12 items-baseline gap-x-6 gap-y-3 border-b border-rule py-7 transition-colors duration-500 md:py-9"
                >
                  <h3 className={`col-span-12 font-display text-[clamp(1.5rem,3.4vw,2.35rem)] font-light leading-none tracking-[-0.012em] transition-colors duration-500 md:col-span-5 ${ativo === i ? 'text-ink' : 'text-ink/70'}`}>
                    {f.titulo}
                  </h3>
                  <p className="col-span-12 font-ui text-[0.9rem] leading-[1.75] text-muted md:col-span-7">
                    {f.texto}
                  </p>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Ato 3 — por que a produção é premium */
function AtoProcesso() {
  return (
    <section className="bg-ink py-24 text-paper md:py-36">
      <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
        <Reveal>
          <div className="max-w-[44rem]">
            <Label dark className="mb-7">O método</Label>
            <h2 className="font-display text-[clamp(2.1rem,5vw,3.8rem)] font-light leading-[1.04] tracking-[-0.018em]">
              Cada página é composta.<br />Nenhuma é preenchida.
            </h2>
          </div>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
          {PROCESSO.map((p, i) => (
            <Reveal key={p.n} delay={i * 110}>
              <div className="group">
                <div className="h-px w-full bg-white/15">
                  <div className="h-px w-0 bg-bronze-300 transition-[width] duration-[900ms] ease-editorial group-hover:w-full" />
                </div>
                <span className="mt-6 block font-ui text-[11px] tabular-nums tracking-[0.24em] text-bronze-300">{p.n}</span>
                <h3 className="mt-5 font-display text-[1.6rem] font-light leading-tight tracking-[-0.01em] md:text-[1.75rem]">{p.titulo}</h3>
                <p className="mt-4 font-ui text-[0.9rem] leading-[1.8] text-paper/55">{p.texto}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Ato 4 — projetos realizados */
function AtoProjetos({ go }) {
  const destaques = PROJETOS.slice(0, 8);
  return (
    <section className="bg-paper py-24 md:py-36">
      <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
        <Reveal>
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <Label className="mb-7">Projetos realizados</Label>
              <h2 className="max-w-[16ch] font-display text-[clamp(2.1rem,5vw,3.8rem)] font-light leading-[1.04] tracking-[-0.018em] text-ink">
                Um acervo construído título a título.
              </h2>
            </div>
            <div className="shrink-0 md:pb-3">
              <LinkBtn href="#/projetos">Ver todos os projetos</LinkBtn>
            </div>
          </div>
          <Rule className="mt-12 md:mt-16" />
        </Reveal>

        <div className="mt-14 md:mt-20">
          <GradeProjetos itens={destaques} onAbrir={() => go('/projetos')} />
        </div>
      </div>
    </section>
  );
}

/* Atos 5 e 6 — autoridade em arquitetura, sem fechar portas */
function AtoAutoridade() {
  return (
    <section className="border-y border-rule bg-sand py-24 md:py-36">
      <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <Reveal>
              <Label className="mb-7">Território de especialização</Label>
              <h2 className="max-w-[15ch] font-display text-[clamp(2.1rem,5vw,3.6rem)] font-light leading-[1.04] tracking-[-0.018em] text-ink">
                Especialistas em arquitetura. Não limitados a ela.
              </h2>
            </Reveal>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <Reveal delay={140}>
              <div className="border-t border-rule pt-8">
                <Label className="mb-5">Onde nosso repertório é mais profundo</Label>
                <p className="font-ui text-[1.0125rem] leading-[1.85] text-ink/80">
                  Arquitetura, design de interiores e paisagismo. É neste território que a
                  427 Design concentrou sua especialização nos últimos anos, produzindo
                  livros de escritório, anuários e publicações de autor para profissionais
                  do setor.
                </p>
              </div>

              <div className="mt-12 border-t border-rule pt-8">
                <Label className="mb-5">E onde mais trabalhamos</Label>
                <p className="font-ui text-[1.0125rem] leading-[1.85] text-ink/80">
                  Empresas de qualquer segmento. Ao longo de quase trinta anos de carreira,
                  Antonio Baldini desenvolveu campanhas, embalagens, materiais promocionais e
                  projetos editoriais para companhias de grande porte — e a editora segue
                  atendendo marcas que precisam de revistas, catálogos e publicações
                  institucionais com o mesmo rigor gráfico.
                </p>
                <div className="mt-9">
                  <LinkBtn href="#/servicos">Conhecer os serviços</LinkBtn>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Vantagens — argumento comercial, do briefing do cliente */
function AtoVantagens() {
  return (
    <section className="bg-paper py-24 md:py-32">
      <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
        <Reveal>
          <Label className="mb-7">Por que publicar</Label>
          <h2 className="max-w-[20ch] font-display text-[clamp(1.9rem,4.4vw,3.1rem)] font-light leading-[1.06] tracking-[-0.018em] text-ink">
            O que uma publicação exclusiva faz pela sua marca.
          </h2>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-10 md:mt-20 md:grid-cols-3">
          {VANTAGENS.map((v, i) => (
            <Reveal key={i} delay={i * 110}>
              <div className="border-t border-rule pt-7">
                <p className="font-ui text-[1rem] leading-[1.8] text-ink/80">{v}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* Ato 7 — como iniciar */
function AtoIniciar() {
  return (
    <section className="relative overflow-hidden bg-ink py-28 text-paper md:py-40">
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
        <div className="mx-auto flex h-full max-w-[92rem] justify-between px-6 md:px-10 lg:px-14">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-full w-px bg-white/[0.055]" />)}
        </div>
      </div>
      <div className="relative mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
        <Reveal>
          <div className="mx-auto max-w-[52rem] text-center">
            <Label dark className="mb-8">Como começar</Label>
            <h2 className="font-display text-[clamp(2.3rem,6vw,4.6rem)] font-light leading-[1.02] tracking-[-0.022em]">
              Toda publicação começa com uma conversa.
            </h2>
            <p className="mx-auto mt-8 max-w-[52ch] font-ui text-[1.0125rem] leading-[1.8] text-paper/60">
              Conte o que você quer publicar. A partir daí definimos formato, extensão,
              produção de conteúdo e viabilidade — sem compromisso.
            </p>
            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
              <SolidBtn href="#/contato" dark>Iniciar um projeto</SolidBtn>
              <SolidBtn href={waLink()} external className="border border-white/20 bg-transparent text-paper hover:border-transparent hover:bg-bronze">
                <Icon name="whatsapp" size={15} /> Falar pelo WhatsApp
              </SolidBtn>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Home({ go }) {
  return (
    <>
      <Hero />
      <AtoFormatos />
      <AtoProcesso />
      <AtoProjetos go={go} />
      <AtoAutoridade />
      <AtoVantagens />
      <AtoIniciar />
    </>
  );
}

/* ============================================================ PROJETOS ==== */

function PaginaProjetos() {
  const [filtro, setFiltro] = useState('Todos');
  const lista = useMemo(
    () => (filtro === 'Todos' ? PROJETOS : PROJETOS.filter((p) => p.categoria === filtro)),
    [filtro]
  );

  return (
    <>
      <PageHead
        eyebrow="Projetos"
        titulo="Publicações que já saíram da gráfica."
        texto="Uma seleção do acervo produzido pela 427 Design: livros de escritório, anuários, revistas e publicações de marca. As imagens de capa serão substituídas pelos arquivos originais da editora."
      />

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-rule pb-6">
            {CATEGORIAS.map((c) => (
              <button
                key={c}
                onClick={() => setFiltro(c)}
                className={`group relative font-ui text-[11px] uppercase tracking-[0.2em] transition-colors duration-400 ${filtro === c ? 'text-ink' : 'text-muted hover:text-ink'}`}
              >
                {c}
                <span className={`absolute -bottom-1.5 left-0 h-px w-full origin-left bg-bronze transition-transform duration-500 ease-editorial ${filtro === c ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
              </button>
            ))}
            <span className="ml-auto font-ui text-[10px] tabular-nums tracking-[0.2em] text-muted">
              {String(lista.length).padStart(2, '0')} {lista.length === 1 ? 'projeto' : 'projetos'}
            </span>
          </div>

          <div className="mt-14 md:mt-20">
            <GradeProjetos itens={lista} />
          </div>
        </div>
      </section>

      <section className="border-t border-rule bg-sand py-20 md:py-28">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <Reveal>
            <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <h2 className="max-w-[20ch] font-display text-[clamp(1.8rem,4vw,2.8rem)] font-light leading-[1.06] tracking-[-0.015em] text-ink">
                O próximo título do acervo pode ser o seu.
              </h2>
              <div className="shrink-0"><SolidBtn href="#/contato">Iniciar um projeto</SolidBtn></div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/* ============================================================ SERVIÇOS ==== */

function PaginaServicos() {
  return (
    <>
      <PageHead
        eyebrow="Serviços"
        titulo="Produção editorial completa, sob um só teto."
        texto="Conte com a nossa experiência de mais de 25 anos no mercado editorial atendendo empresas e profissionais de diversos segmentos."
      >
        <div className="mt-8"><LinkBtn href="#/contato">Solicitar uma proposta</LinkBtn></div>
      </PageHead>

      {/* Formatos */}
      <section className="bg-paper py-24 md:py-32">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <Reveal><Label className="mb-10">O que produzimos</Label></Reveal>
          <div className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
            {FORMATOS.map((f, i) => (
              <Reveal key={f.titulo} delay={(i % 3) * 110}>
                <article className="group h-full border-t border-rule pt-7">
                  <h3 className="font-display text-[1.75rem] font-light leading-tight tracking-[-0.01em] text-ink md:text-[2rem]">
                    {f.titulo}
                  </h3>
                  <p className="mt-4 font-ui text-[0.95rem] leading-[1.8] text-muted">{f.texto}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Processo */}
      <AtoProcesso />

      {/* Segmentos atendidos */}
      <section className="border-b border-rule bg-sand py-24 md:py-32">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-5">
              <Reveal>
                <Label className="mb-7">Para quem trabalhamos</Label>
                <h2 className="max-w-[15ch] font-display text-[clamp(2rem,4.6vw,3.3rem)] font-light leading-[1.05] tracking-[-0.018em] text-ink">
                  Profissionais, escritórios e empresas.
                </h2>
              </Reveal>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <Reveal delay={130}>
                <div className="border-t border-rule pt-8">
                  <h3 className="font-display text-2xl font-light text-ink">Arquitetura, interiores e paisagismo</h3>
                  <p className="mt-4 font-ui text-[0.975rem] leading-[1.8] text-muted">
                    Livros de escritório, livros de autor, anuários e portfólios impressos para
                    arquitetos, designers de interiores e paisagistas — nossa especialização
                    mais profunda.
                  </p>
                </div>
                <div className="mt-10 border-t border-rule pt-8">
                  <h3 className="font-display text-2xl font-light text-ink">Empresas de outros segmentos</h3>
                  <p className="mt-4 font-ui text-[0.975rem] leading-[1.8] text-muted">
                    Revistas de marca, catálogos de produto e coleção, publicações
                    institucionais e comemorativas, materiais promocionais e embalagens —
                    para companhias de qualquer setor.
                  </p>
                </div>
                <div className="mt-10 border-t border-rule pt-8">
                  <h3 className="font-display text-2xl font-light text-ink">Publicações periódicas</h3>
                  <p className="mt-4 font-ui text-[0.975rem] leading-[1.8] text-muted">
                    Projetos com continuidade editorial: edições recorrentes, anuários e
                    magazines com identidade gráfica própria.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <AtoVantagens />
      <AtoIniciar />
    </>
  );
}

/* =============================================================== SOBRE ==== */

function PaginaSobre() {
  return (
    <>
      <PageHead
        eyebrow="Sobre"
        titulo="Uma editora que trata o impresso como produto final."
        texto="A 427 Design é uma agência e editora com sede em São Paulo, especializada na produção de projetos editoriais para empresas e profissionais."
      />

      {/* Antonio Baldini */}
      <section className="bg-paper py-24 md:py-36">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <Reveal>
                <MolduraFoto
                  src={ASSETS.retratoAntonio}
                  alt="Antonio Baldini, diretor fundador da 427 Design"
                  legenda="Antonio Baldini · Diretor fundador"
                  ratio="4 / 5"
                />
              </Reveal>
            </div>

            <div className="lg:col-span-6 lg:col-start-7 lg:pt-6">
              <Reveal delay={120}>
                <Label className="mb-7">Diretor fundador</Label>
                <h2 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] font-light leading-[1.03] tracking-[-0.02em] text-ink">
                  Antonio Baldini
                </h2>
                <div className="mt-9 space-y-6 font-ui text-[1rem] leading-[1.85] text-ink/75">
                  <p>
                    Antonio Baldini é formado em propaganda e marketing e diretor fundador da
                    agência e editora 427 Design.
                  </p>
                  <p>
                    Ao longo de quase trinta anos atendeu diversas empresas de grande porte
                    desenvolvendo campanhas publicitárias, embalagens, materiais promocionais e
                    projetos editoriais para diversos segmentos.
                  </p>
                  <p>
                    Nos últimos anos a 427 Design tem focado, dedicado e se especializado na
                    produção de projetos editoriais para os segmentos de arquitetura, design de
                    interiores e paisagismo, além de produzir revistas e livros para grandes
                    empresas também desse setor.
                  </p>
                  <p>
                    A expertise e o know-how de todo esse tempo garantem à editora a confiança e a
                    credibilidade que um profissional ou empresa precisa ao contratar uma editora
                    para a publicação de um produto tão único e especial como um livro ou a
                    revista de sua empresa.
                  </p>
                </div>
                <div className="mt-11">
                  <SolidBtn href={waLink('Olá, Antonio! Conheci a 427 Design pelo site e gostaria de conversar sobre um projeto editorial.')} external>
                    <Icon name="whatsapp" size={15} /> Falar com o Antonio
                  </SolidBtn>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* A editora */}
      <section className="border-y border-rule bg-sand py-24 md:py-32">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-4">
              <Reveal><Label className="mb-7">A editora</Label></Reveal>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <Reveal delay={110}>
                <p className="font-display text-[clamp(1.6rem,3.4vw,2.5rem)] font-light leading-[1.28] tracking-[-0.012em] text-ink">
                  Temos tudo que você precisa para a produção e publicação do seu projeto
                  editorial — do conceito e da direção de arte ao acompanhamento de impressão.
                </p>
                <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
                  {[
                    { k: 'Sede', v: 'São Paulo, Brasil' },
                    { k: 'Atuação', v: 'Projetos editoriais sob medida' },
                    { k: 'Especialização', v: 'Arquitetura, interiores e paisagismo' },
                  ].map((x) => (
                    <div key={x.k} className="border-t border-rule pt-5">
                      <Label className="mb-3">{x.k}</Label>
                      <p className="font-ui text-[0.95rem] leading-[1.7] text-ink/75">{x.v}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <AtoIniciar />
    </>
  );
}

/* ============================================================= CONTATO ==== */

const TIPOS_PROJETO = ['Livro', 'Revista', 'Catálogo', 'Publicação corporativa', 'Outro material impresso', 'Ainda não sei'];

function PaginaContato() {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', empresa: '', tipo: '', mensagem: '' });
  const [erros, setErros] = useState({});
  const [enviado, setEnviado] = useState(false);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErros((x) => ({ ...x, [k]: undefined }));
  };

  const validar = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Informe seu nome.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)) e.email = 'Informe um e-mail válido.';
    if (!form.mensagem.trim()) e.mensagem = 'Conte um pouco sobre o projeto.';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const enviar = (ev) => {
    ev.preventDefault();
    if (!validar()) return;
    const msg =
      `Olá! Vim pelo site da 427 Design.\n\n` +
      `Nome: ${form.nome}\n` +
      `E-mail: ${form.email}\n` +
      (form.telefone ? `Telefone: ${form.telefone}\n` : '') +
      (form.empresa ? `Empresa: ${form.empresa}\n` : '') +
      (form.tipo ? `Tipo de projeto: ${form.tipo}\n` : '') +
      `\n${form.mensagem}`;
    setEnviado(true);
    window.open(waLink(msg), '_blank', 'noopener');
  };

  const campo = 'w-full border-0 border-b border-rule bg-transparent pb-3 pt-2 font-ui text-[0.975rem] text-ink placeholder:text-muted/60 transition-colors duration-400 focus:border-ink focus:outline-none focus:ring-0';

  return (
    <>
      <PageHead
        eyebrow="Contato"
        titulo="Conte o que você quer publicar."
        texto="Respondemos com as primeiras definições de formato, extensão e viabilidade. Sem compromisso."
      />

      <section className="bg-paper py-20 md:py-28">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-14">
            {/* Formulário */}
            <div className="lg:col-span-7">
              <Reveal>
                {enviado ? (
                  <div className="border-t border-rule pt-10">
                    <Label className="mb-6">Conversa aberta</Label>
                    <h2 className="max-w-[18ch] font-display text-[clamp(1.8rem,4vw,2.8rem)] font-light leading-[1.08] tracking-[-0.015em] text-ink">
                      Abrimos o WhatsApp com a sua mensagem pronta.
                    </h2>
                    <p className="mt-6 max-w-[46ch] font-ui text-[0.975rem] leading-[1.8] text-muted">
                      Se a janela não tiver aberto, o bloqueador de pop-ups pode ter impedido.
                      Use o botão abaixo ou escreva diretamente para {CONTATO.email}.
                    </p>
                    <div className="mt-9 flex flex-wrap gap-4">
                      <SolidBtn href={waLink()} external><Icon name="whatsapp" size={15} /> Abrir WhatsApp</SolidBtn>
                      <button onClick={() => setEnviado(false)} className="font-ui text-[11px] uppercase tracking-[0.2em] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline">
                        Editar mensagem
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={enviar} noValidate>
                    <div className="grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2">
                      <div className="sm:col-span-1">
                        <label htmlFor="nome" className="mb-2 block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">Nome *</label>
                        <input id="nome" className={campo} value={form.nome} onChange={set('nome')} placeholder="Seu nome" />
                        {erros.nome && <p className="mt-2 font-ui text-[11px] text-clay">{erros.nome}</p>}
                      </div>
                      <div className="sm:col-span-1">
                        <label htmlFor="email" className="mb-2 block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">E-mail *</label>
                        <input id="email" type="email" className={campo} value={form.email} onChange={set('email')} placeholder="voce@empresa.com.br" />
                        {erros.email && <p className="mt-2 font-ui text-[11px] text-clay">{erros.email}</p>}
                      </div>
                      <div className="sm:col-span-1">
                        <label htmlFor="telefone" className="mb-2 block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">Telefone</label>
                        <input id="telefone" type="tel" className={campo} value={form.telefone} onChange={set('telefone')} placeholder="(11) 90000-0000" />
                      </div>
                      <div className="sm:col-span-1">
                        <label htmlFor="empresa" className="mb-2 block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">Empresa ou escritório</label>
                        <input id="empresa" className={campo} value={form.empresa} onChange={set('empresa')} placeholder="Opcional" />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="tipo" className="mb-2 block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">Tipo de projeto</label>
                        <select id="tipo" className={`${campo} cursor-pointer`} value={form.tipo} onChange={set('tipo')}>
                          <option value="">Selecione</option>
                          {TIPOS_PROJETO.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="mensagem" className="mb-2 block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">Sobre o projeto *</label>
                        <textarea id="mensagem" rows={4} className={`${campo} resize-none`} value={form.mensagem} onChange={set('mensagem')} placeholder="O que você quer publicar?" />
                        {erros.mensagem && <p className="mt-2 font-ui text-[11px] text-clay">{erros.mensagem}</p>}
                      </div>
                    </div>
                    <div className="mt-12 flex flex-wrap items-center gap-6">
                      <SolidBtn type="submit">Enviar mensagem</SolidBtn>
                      <p className="max-w-[28ch] font-ui text-[11px] leading-relaxed text-muted">
                        O envio abre uma conversa no WhatsApp com os dados preenchidos.
                      </p>
                    </div>
                  </form>
                )}
              </Reveal>
            </div>

            {/* Contatos diretos */}
            <div className="lg:col-span-4 lg:col-start-9">
              <Reveal delay={140}>
                <div className="border-t border-rule pt-8">
                  <Label className="mb-6">Contato direto</Label>
                  <ul className="space-y-6">
                    <li>
                      <span className="block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">WhatsApp</span>
                      <a href={waLink()} target="_blank" rel="noopener noreferrer" className="mt-1.5 block font-display text-2xl font-light text-ink underline-offset-[6px] transition-colors hover:text-bronze hover:underline">
                        {CONTATO.telefone}
                      </a>
                    </li>
                    <li>
                      <span className="block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">E-mail</span>
                      <a href={`mailto:${CONTATO.email}`} className="mt-1.5 block break-all font-display text-2xl font-light text-ink underline-offset-[6px] transition-colors hover:text-bronze hover:underline">
                        {CONTATO.email}
                      </a>
                    </li>
                    <li>
                      <span className="block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">Instagram</span>
                      <a href={CONTATO.instagramUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 block font-display text-2xl font-light text-ink underline-offset-[6px] transition-colors hover:text-bronze hover:underline">
                        @{CONTATO.instagram}
                      </a>
                    </li>
                    <li className="pt-2">
                      <span className="block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">Localização</span>
                      <p className="mt-1.5 font-ui text-[0.975rem] text-ink/75">{CONTATO.cidade}</p>
                    </li>
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ========================================================= PUBLICAÇÕES ==== */

/* Resolve a capa de um produto: usa o projeto correspondente quando existe. */
function capaDoProduto(p) {
  const proj = PROJETOS.find((x) => x.slug === p.slug);
  if (proj) return proj;
  return { slug: p.slug, titulo: p.titulo.replace(/^Livro\s+/, '').replace(/^Anuário de decoração\s+/, ''), linha: p.linha, tom: 'stone' };
}

function CartaoProduto({ p, delay = 0 }) {
  const { adicionar } = useCarrinho();
  return (
    <Reveal delay={delay}>
      <article className="group flex h-full flex-col">
        <a href={`#/publicacoes/${p.sku}`} className="block">
          <Capa item={capaDoProduto(p)} />
        </a>
        <div className="mt-5 flex flex-1 flex-col">
          <div className="h-px w-full bg-rule">
            <div className="h-px w-0 bg-bronze transition-[width] duration-700 ease-editorial group-hover:w-full" />
          </div>
          <a href={`#/publicacoes/${p.sku}`} className="mt-4 block">
            <h3 className="font-display text-lg font-light leading-snug text-ink transition-colors duration-400 group-hover:text-bronze md:text-xl">
              {p.titulo}
            </h3>
          </a>
          <p className="mt-1.5 font-ui text-[10px] uppercase tracking-[0.18em] text-muted">{p.linha}</p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            <span className="font-ui text-[0.95rem] tabular-nums text-ink">{brl(p.preco)}</span>
            <button
              onClick={() => adicionar(p)}
              className="font-ui text-[10px] uppercase tracking-[0.18em] text-muted underline-offset-4 transition-colors duration-400 hover:text-ink hover:underline"
            >
              Adicionar
            </button>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

function PaginaPublicacoes() {
  const [cat, setCat] = useState('Todas');
  const lista = useMemo(() => (cat === 'Todas' ? PRODUTOS : PRODUTOS.filter((p) => p.categoria === cat)), [cat]);

  return (
    <>
      <PageHead
        eyebrow="Publicações"
        titulo="Edições impressas disponíveis."
        texto="Títulos produzidos pela 427 Design e disponíveis para compra. Envio para todo o Brasil; frete e prazo confirmados na finalização do pedido."
      />

      <section className="bg-paper py-14 md:py-20">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-rule pb-6">
            {CAT_LOJA.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`group relative font-ui text-[11px] uppercase tracking-[0.2em] transition-colors duration-400 ${cat === c ? 'text-ink' : 'text-muted hover:text-ink'}`}
              >
                {c}
                <span className={`absolute -bottom-1.5 left-0 h-px w-full origin-left bg-bronze transition-transform duration-500 ease-editorial ${cat === c ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
              </button>
            ))}
            <span className="ml-auto font-ui text-[10px] tabular-nums tracking-[0.2em] text-muted">
              {String(lista.length).padStart(2, '0')} {lista.length === 1 ? 'título' : 'títulos'}
            </span>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-x-5 gap-y-14 md:mt-20 md:grid-cols-3 md:gap-x-8 md:gap-y-16 lg:grid-cols-4">
            {lista.map((p, i) => <CartaoProduto key={p.sku} p={p} delay={(i % 4) * 90} />)}
          </div>
        </div>
      </section>

      <section className="border-t border-rule bg-sand py-16 md:py-20">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <Reveal>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {[
                { t: 'Envio para todo o Brasil', d: 'Frete e prazo calculados na finalização do pedido.' },
                { t: 'Compra por WhatsApp', d: 'Pedido confirmado diretamente com a editora, sem intermediários.' },
                { t: 'Edições limitadas', d: 'Tiragens de projetos editoriais produzidos pela própria 427.' },
              ].map((x) => (
                <div key={x.t} className="border-t border-rule pt-6">
                  <h3 className="font-ui text-[11px] uppercase tracking-[0.2em] text-ink">{x.t}</h3>
                  <p className="mt-3 font-ui text-[0.9rem] leading-[1.75] text-muted">{x.d}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------- PRODUTO ---- */

function PaginaProduto({ sku, go }) {
  const p = PRODUTOS.find((x) => x.sku === sku);
  const { adicionar } = useCarrinho();
  const [qtd, setQtd] = useState(1);

  useEffect(() => { setQtd(1); }, [sku]);

  if (!p) {
    return (
      <section className="flex min-h-[70vh] items-center bg-paper pt-28">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <Label className="mb-6">Publicação não encontrada</Label>
          <h1 className="font-display text-[clamp(2rem,5vw,3.4rem)] font-light leading-tight text-ink">
            Este título não está no catálogo.
          </h1>
          <div className="mt-9"><LinkBtn href="#/publicacoes">Ver todas as publicações</LinkBtn></div>
        </div>
      </section>
    );
  }

  const relacionados = PRODUTOS.filter((x) => x.sku !== p.sku).slice(0, 4);

  return (
    <>
      <section className="bg-paper pb-20 pt-28 md:pb-28 md:pt-40">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          {/* trilha */}
          <nav aria-label="Trilha" className="mb-12 flex flex-wrap items-center gap-2 font-ui text-[10px] uppercase tracking-[0.2em] text-muted md:mb-16">
            <a href="#/" className="transition-colors hover:text-ink">Início</a>
            <span aria-hidden="true">·</span>
            <a href="#/publicacoes" className="transition-colors hover:text-ink">Publicações</a>
            <span aria-hidden="true">·</span>
            <span className="text-ink/60">{p.categoria}</span>
          </nav>

          <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16">
            {/* capa */}
            <div className="lg:col-span-6">
              <Reveal>
                <div className="mx-auto w-[72%] sm:w-[52%] lg:w-[82%]">
                  <div className="produto-capa"><Capa item={capaDoProduto(p)} priority /></div>
                </div>
              </Reveal>
            </div>

            {/* ficha */}
            <div className="lg:col-span-5 lg:col-start-8 lg:pt-4">
              <Reveal delay={120}>
                <Label className="mb-6">{p.linha}</Label>
                <h1 className="font-display text-[clamp(2rem,4.6vw,3.2rem)] font-light leading-[1.06] tracking-[-0.018em] text-ink">
                  {p.titulo}
                </h1>

                <p className="mt-8 font-display text-[1.9rem] font-light tabular-nums text-ink">{brl(p.preco)}</p>

                {p.descricao ? (
                  <p className="mt-8 font-ui text-[1rem] leading-[1.85] text-ink/75">{p.descricao}</p>
                ) : (
                  <p className="mt-8 font-ui text-[0.95rem] leading-[1.8] text-muted">
                    Edição impressa produzida pela 427 Design. Ficha técnica completa —
                    formato, número de páginas e acabamento — disponível sob consulta.
                  </p>
                )}

                <Rule className="mt-10" />

                {/* quantidade + compra */}
                <div className="mt-8 flex flex-wrap items-center gap-5">
                  <div className="flex items-center border border-rule">
                    <button onClick={() => setQtd((q) => Math.max(1, q - 1))} aria-label="Diminuir quantidade" className="px-3.5 py-3.5 text-ink/60 transition-colors hover:text-ink">
                      <Icon name="minus" size={14} />
                    </button>
                    <span className="min-w-[2.25rem] text-center font-ui text-sm tabular-nums text-ink">{qtd}</span>
                    <button onClick={() => setQtd((q) => Math.min(20, q + 1))} aria-label="Aumentar quantidade" className="px-3.5 py-3.5 text-ink/60 transition-colors hover:text-ink">
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                  <SolidBtn onClick={() => adicionar(p, qtd)} className="flex-1 min-w-[12rem]">Adicionar ao carrinho</SolidBtn>
                </div>

                <div className="mt-6">
                  <a
                    href={waLink(`Olá! Tenho interesse no título "${p.titulo}"${p.linha ? ` (${p.linha})` : ''}. Pode me passar mais informações?`)}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 font-ui text-[11px] uppercase tracking-[0.18em] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    <Icon name="whatsapp" size={14} /> Tirar uma dúvida sobre este título
                  </a>
                </div>

                {/* ficha técnica — campos prontos para os dados reais */}
                <dl className="mt-12 border-t border-rule">
                  {[
                    ['Referência', p.sku],
                    ['Categoria', p.categoria],
                    ['Editora', '427 Design'],
                    ['Envio', 'Todo o Brasil · frete na finalização'],
                  ].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-12 gap-4 border-b border-rule py-4">
                      <dt className="col-span-5 font-ui text-[10px] uppercase tracking-[0.2em] text-muted sm:col-span-4">{k}</dt>
                      <dd className="col-span-7 font-ui text-[0.9rem] text-ink/75 sm:col-span-8">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* relacionados */}
      <section className="border-t border-rule bg-sand py-20 md:py-28">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <Reveal>
            <div className="flex items-end justify-between gap-8">
              <h2 className="font-display text-[clamp(1.6rem,3.4vw,2.4rem)] font-light leading-tight tracking-[-0.015em] text-ink">
                Outras publicações
              </h2>
              <div className="shrink-0"><LinkBtn href="#/publicacoes">Ver catálogo</LinkBtn></div>
            </div>
            <Rule className="mt-8" />
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-4 md:gap-x-8">
            {relacionados.map((r, i) => <CartaoProduto key={r.sku} p={r} delay={i * 80} />)}
          </div>
        </div>
      </section>
    </>
  );
}

/* ============================================================ CHECKOUT ==== */

function Campo({ id, label, value, onChange, erro, tipo = 'text', placeholder, autoComplete, className = '', inputMode }) {
  const base = 'w-full border-0 border-b bg-transparent pb-3 pt-2 font-ui text-[0.975rem] text-ink placeholder:text-muted/55 transition-colors duration-400 focus:outline-none focus:ring-0';
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block font-ui text-[10px] uppercase tracking-[0.2em] text-muted">{label}</label>
      <input
        id={id} name={id} type={tipo} value={value} onChange={onChange}
        placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode}
        aria-invalid={erro ? 'true' : undefined}
        className={`${base} ${erro ? 'border-clay' : 'border-rule focus:border-ink'}`}
      />
      {erro && <p className="mt-2 font-ui text-[11px] text-clay">{erro}</p>}
    </div>
  );
}

function EtapaTitulo({ n, children }) {
  return (
    <div className="mb-8 flex items-baseline gap-5 border-t border-rule pt-7">
      <span className="font-ui text-[10px] tabular-nums tracking-[0.24em] text-bronze">{n}</span>
      <h2 className="font-display text-2xl font-light leading-none tracking-[-0.01em] text-ink md:text-[1.75rem]">{children}</h2>
    </div>
  );
}

function PaginaCheckout({ go }) {
  const { itens, total, limpar } = useCarrinho();

  const [f, setF] = useState({
    nome: '', email: '', telefone: '', cpf: '',
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  });
  const [erros, setErros] = useState({});
  const [frete, setFrete] = useState(null);      // { zona, opcoes }
  const [freteSel, setFreteSel] = useState(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [metodo, setMetodo] = useState('pix');
  const [processando, setProcessando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const set = (k, mascara) => (e) => {
    const v = mascara ? mascara(e.target.value) : e.target.value;
    setF((x) => ({ ...x, [k]: v }));
    setErros((x) => ({ ...x, [k]: undefined }));
  };

  /* CEP completo: calcula frete e tenta preencher o endereço. */
  useEffect(() => {
    const d = soDigitos(f.cep);
    if (d.length !== 8) { setFrete(null); setFreteSel(null); return; }
    const opts = opcoesFrete(d, total);
    setFrete(opts);
    setFreteSel(opts && opts.opcoes.length ? opts.opcoes[0].id : null);
    let vivo = true;
    setBuscandoCep(true);
    buscarCep(d).then((r) => {
      if (!vivo) return;
      setBuscandoCep(false);
      if (r) setF((x) => ({ ...x, logradouro: r.logradouro || x.logradouro, bairro: r.bairro || x.bairro, cidade: r.cidade || x.cidade, uf: r.uf || x.uf }));
    });
    return () => { vivo = false; };
  }, [f.cep, total]);

  const opcaoFrete = frete && frete.opcoes.find((o) => o.id === freteSel);
  const valorFrete = opcaoFrete ? opcaoFrete.preco : 0;
  const totalGeral = total + valorFrete;

  const validar = () => {
    const e = {};
    if (!f.nome.trim() || f.nome.trim().split(/\s+/).length < 2) e.nome = 'Informe nome e sobrenome.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Informe um e-mail válido.';
    if (soDigitos(f.telefone).length < 10) e.telefone = 'Informe o DDD e o número.';
    if (!cpfValido(f.cpf)) e.cpf = 'CPF inválido.';
    if (soDigitos(f.cep).length !== 8) e.cep = 'Informe um CEP com 8 dígitos.';
    if (!f.logradouro.trim()) e.logradouro = 'Informe a rua.';
    if (!f.numero.trim()) e.numero = 'Informe o número.';
    if (!f.bairro.trim()) e.bairro = 'Informe o bairro.';
    if (!f.cidade.trim()) e.cidade = 'Informe a cidade.';
    if (!/^[A-Za-z]{2}$/.test(f.uf.trim())) e.uf = 'UF com 2 letras.';
    setErros(e);
    if (Object.keys(e).length) {
      const primeiro = document.getElementById(Object.keys(e)[0]);
      if (primeiro) primeiro.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return false;
    }
    if (!opcaoFrete) { setAviso('Escolha uma opção de entrega.'); return false; }
    return true;
  };

  const concluir = async (ev) => {
    ev.preventDefault();
    setAviso(null);
    if (!validar()) return;
    setProcessando(true);

    const pedido = {
      numero: '427-' + String(Date.now()).slice(-6),
      criadoEm: new Date().toISOString(),
      itens: itens.map(({ sku, slug, titulo, linha, preco, qtd }) => ({ sku, slug, titulo, linha, preco, qtd })),
      cliente: { nome: f.nome.trim(), email: f.email.trim(), telefone: f.telefone, cpf: f.cpf },
      entrega: {
        cep: f.cep, logradouro: f.logradouro, numero: f.numero, complemento: f.complemento,
        bairro: f.bairro, cidade: f.cidade, uf: f.uf.toUpperCase(),
        modalidade: opcaoFrete.nome, prazo: opcaoFrete.prazo, valor: valorFrete,
      },
      pagamento: { metodo, gateway: CONFIG.gateway },
      valores: { subtotal: total, frete: valorFrete, total: totalGeral },
    };

    const r = await iniciarPagamento(pedido);
    if (r && r.redirecionado) return; // o gateway assume a navegação

    guardarPedido(pedido);
    limpar();
    setProcessando(false);
    go('/pedido');
  };

  if (itens.length === 0) {
    return (
      <section className="flex min-h-[72vh] items-center bg-paper pt-28">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <Label className="mb-6">Checkout</Label>
          <h1 className="max-w-[18ch] font-display text-[clamp(2rem,5vw,3.4rem)] font-light leading-[1.04] tracking-[-0.018em] text-ink">
            Não há nada no seu carrinho.
          </h1>
          <div className="mt-9"><LinkBtn href="#/publicacoes">Ver as publicações</LinkBtn></div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-paper pb-24 pt-28 md:pb-32 md:pt-40">
      <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
        <nav aria-label="Trilha" className="mb-10 flex flex-wrap items-center gap-2 font-ui text-[10px] uppercase tracking-[0.2em] text-muted md:mb-14">
          <a href="#/publicacoes" className="transition-colors hover:text-ink">Publicações</a>
          <span aria-hidden="true">·</span>
          <span className="text-ink/60">Checkout</span>
        </nav>

        <h1 className="mb-14 font-display text-[clamp(2.2rem,5.2vw,3.6rem)] font-light leading-[1.02] tracking-[-0.02em] text-ink md:mb-20">
          Finalizar pedido
        </h1>

        <form onSubmit={concluir} noValidate className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-14">
          {/* ------------------------------ formulário */}
          <div className="lg:col-span-7">
            {/* 01 contato */}
            <EtapaTitulo n="01">Seus dados</EtapaTitulo>
            <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
              <Campo id="nome" label="Nome completo *" value={f.nome} onChange={set('nome')} erro={erros.nome} autoComplete="name" placeholder="Nome e sobrenome" className="sm:col-span-2" />
              <Campo id="email" label="E-mail *" tipo="email" value={f.email} onChange={set('email')} erro={erros.email} autoComplete="email" placeholder="voce@email.com.br" inputMode="email" />
              <Campo id="telefone" label="Telefone *" tipo="tel" value={f.telefone} onChange={set('telefone', mascaraTel)} erro={erros.telefone} autoComplete="tel" placeholder="(11) 90000-0000" inputMode="tel" />
              <Campo id="cpf" label="CPF *" value={f.cpf} onChange={set('cpf', mascaraCpf)} erro={erros.cpf} placeholder="000.000.000-00" inputMode="numeric" />
            </div>

            {/* 02 entrega */}
            <div className="mt-16">
              <EtapaTitulo n="02">Endereço de entrega</EtapaTitulo>
              <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-6">
                <div className="sm:col-span-2">
                  <Campo id="cep" label="CEP *" value={f.cep} onChange={set('cep', mascaraCep)} erro={erros.cep} autoComplete="postal-code" placeholder="00000-000" inputMode="numeric" />
                  {buscandoCep && <p className="mt-2 font-ui text-[11px] text-muted">Consultando…</p>}
                </div>
                <Campo id="logradouro" label="Rua *" value={f.logradouro} onChange={set('logradouro')} erro={erros.logradouro} autoComplete="address-line1" placeholder="Av. Paulista" className="sm:col-span-4" />
                <Campo id="numero" label="Número *" value={f.numero} onChange={set('numero')} erro={erros.numero} placeholder="1000" className="sm:col-span-2" />
                <Campo id="complemento" label="Complemento" value={f.complemento} onChange={set('complemento')} placeholder="Apto, bloco" className="sm:col-span-4" />
                <Campo id="bairro" label="Bairro *" value={f.bairro} onChange={set('bairro')} erro={erros.bairro} placeholder="Bela Vista" className="sm:col-span-3" />
                <Campo id="cidade" label="Cidade *" value={f.cidade} onChange={set('cidade')} erro={erros.cidade} placeholder="São Paulo" className="sm:col-span-2" />
                <Campo id="uf" label="UF *" value={f.uf} onChange={(e) => { setF((x) => ({ ...x, uf: e.target.value.toUpperCase().slice(0, 2) })); setErros((x) => ({ ...x, uf: undefined })); }} erro={erros.uf} placeholder="SP" className="sm:col-span-1" />
              </div>
            </div>

            {/* 03 frete */}
            <div className="mt-16">
              <EtapaTitulo n="03">Entrega</EtapaTitulo>
              {!frete ? (
                <p className="font-ui text-[0.95rem] leading-relaxed text-muted">
                  Informe o CEP acima para ver as opções de envio e o prazo.
                </p>
              ) : (
                <>
                  <p className="mb-6 font-ui text-[11px] uppercase tracking-[0.18em] text-muted">Destino · {frete.zona}</p>
                  <div className="border-t border-rule">
                    {frete.opcoes.map((o) => (
                      <label key={o.id} className={`flex cursor-pointer items-center justify-between gap-5 border-b border-rule py-5 transition-colors duration-400 ${freteSel === o.id ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                        <span className="flex items-center gap-4">
                          <input
                            type="radio" name="frete" value={o.id} checked={freteSel === o.id}
                            onChange={() => { setFreteSel(o.id); setAviso(null); }}
                            className="h-[15px] w-[15px] shrink-0 appearance-none rounded-full border border-rule transition-colors duration-300 checked:border-[5px] checked:border-bronze"
                          />
                          <span>
                            <span className="block font-ui text-[0.95rem]">{o.nome}</span>
                            <span className="mt-0.5 block font-ui text-[11px] text-muted">{o.prazo}</span>
                          </span>
                        </span>
                        <span className="font-ui text-[0.95rem] tabular-nums">{o.preco === 0 ? 'Grátis' : brl(o.preco)}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 04 pagamento */}
            <div className="mt-16">
              <EtapaTitulo n="04">Pagamento</EtapaTitulo>
              <div className="border-t border-rule">
                {METODOS.map((m) => (
                  <label key={m.id} className={`flex cursor-pointer items-center gap-4 border-b border-rule py-5 transition-colors duration-400 ${metodo === m.id ? 'text-ink' : 'text-muted hover:text-ink'}`}>
                    <input
                      type="radio" name="metodo" value={m.id} checked={metodo === m.id}
                      onChange={() => setMetodo(m.id)}
                      className="h-[15px] w-[15px] shrink-0 appearance-none rounded-full border border-rule transition-colors duration-300 checked:border-[5px] checked:border-bronze"
                    />
                    <span>
                      <span className="block font-ui text-[0.95rem]">{m.nome}</span>
                      <span className="mt-0.5 block font-ui text-[11px] text-muted">{m.nota}</span>
                    </span>
                  </label>
                ))}
              </div>
              {!CONFIG.gateway && (
                <p className="mt-6 max-w-[52ch] font-ui text-[11px] leading-relaxed text-muted">
                  A cobrança é feita na etapa seguinte, assim que o meio de pagamento
                  da editora estiver ativo. O pedido fica registrado com todos os dados.
                </p>
              )}
            </div>
          </div>

          {/* ------------------------------ resumo */}
          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="lg:sticky lg:top-28">
              <div className="border-t border-rule pt-7">
                <Label className="mb-7">Resumo do pedido</Label>

                {itens.map((x) => (
                  <div key={x.sku} className="flex gap-5 border-b border-rule pb-5 pt-1 [&:not(:last-of-type)]:mb-5">
                    <div className="w-14 shrink-0"><Capa item={capaDoProduto(x)} /></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-light leading-snug text-ink">{x.titulo}</h3>
                      <p className="mt-1 font-ui text-[10px] uppercase tracking-[0.16em] text-muted">
                        {x.qtd} × {brl(x.preco)}
                      </p>
                    </div>
                    <span className="font-ui text-[0.9rem] tabular-nums text-ink">{brl(x.preco * x.qtd)}</span>
                  </div>
                ))}

                <dl className="mt-7 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <dt className="font-ui text-[0.9rem] text-muted">Subtotal</dt>
                    <dd className="font-ui text-[0.9rem] tabular-nums text-ink">{brl(total)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="font-ui text-[0.9rem] text-muted">Entrega</dt>
                    <dd className="font-ui text-[0.9rem] tabular-nums text-ink">
                      {opcaoFrete ? (valorFrete === 0 ? 'Grátis' : brl(valorFrete)) : '—'}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex items-baseline justify-between border-t border-rule pt-6">
                  <span className="font-ui text-[11px] uppercase tracking-[0.2em] text-ink">Total</span>
                  <span className="font-display text-[1.9rem] font-light tabular-nums text-ink">{brl(totalGeral)}</span>
                </div>

                {aviso && <p className="mt-5 font-ui text-[11px] text-clay">{aviso}</p>}

                <SolidBtn type="submit" full className="mt-7">
                  {processando ? 'Registrando…' : 'Concluir pedido'}
                </SolidBtn>

                <p className="mt-5 flex items-center justify-center gap-2 font-ui text-[10px] uppercase tracking-[0.18em] text-muted">
                  <Icon name="lock" size={13} /> Dados enviados apenas à editora
                </p>

                <a
                  href={waLink('Olá! Estou finalizando um pedido no site e tenho uma dúvida.')}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-6 flex items-center justify-center gap-2.5 font-ui text-[10px] uppercase tracking-[0.18em] text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  <Icon name="whatsapp" size={13} /> Prefiro falar com alguém
                </a>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </section>
  );
}

/* ------------------------------------------------- PEDIDO CONFIRMADO ----- */

function PaginaPedido() {
  const p = lerPedido();

  if (!p) {
    return (
      <section className="flex min-h-[72vh] items-center bg-paper pt-28">
        <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
          <Label className="mb-6">Pedido</Label>
          <h1 className="max-w-[20ch] font-display text-[clamp(2rem,5vw,3.4rem)] font-light leading-[1.04] tracking-[-0.018em] text-ink">
            Não encontramos um pedido nesta sessão.
          </h1>
          <div className="mt-9"><LinkBtn href="#/publicacoes">Voltar ao catálogo</LinkBtn></div>
        </div>
      </section>
    );
  }

  const resumoWhats =
    `Olá! Acabei de fechar o pedido ${p.numero} no site da 427 Design.\n\n` +
    p.itens.map((x) => `• ${x.titulo} — ${x.qtd}× ${brl(x.preco)}`).join('\n') +
    `\n\nEntrega: ${p.entrega.modalidade} (${p.entrega.prazo})\nTotal: ${brl(p.valores.total)}`;

  return (
    <section className="bg-paper pb-24 pt-28 md:pb-32 md:pt-40">
      <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-6">
            <span className="mb-8 flex h-12 w-12 items-center justify-center rounded-full border border-bronze/40 text-bronze">
              <Icon name="check" size={20} />
            </span>
            <Label className="mb-6">Pedido {p.numero}</Label>
            <h1 className="max-w-[16ch] font-display text-[clamp(2.2rem,5.2vw,3.8rem)] font-light leading-[1.02] tracking-[-0.02em] text-ink">
              Pedido registrado.
            </h1>
            <p className="mt-8 max-w-[46ch] font-ui text-[1rem] leading-[1.85] text-ink/75">
              Enviamos a confirmação para <strong className="font-medium">{p.cliente.email}</strong>.
              A editora entra em contato para concluir o pagamento via {METODOS.find((m) => m.id === p.pagamento.metodo)?.nome} e liberar o envio.
            </p>

            <div className="mt-12 border-t border-rule pt-7">
              <Label className="mb-5">Entrega</Label>
              <p className="font-ui text-[0.95rem] leading-[1.75] text-ink/75">
                {p.entrega.logradouro}, {p.entrega.numero}{p.entrega.complemento ? ` — ${p.entrega.complemento}` : ''}<br />
                {p.entrega.bairro} · {p.entrega.cidade}/{p.entrega.uf} · {p.entrega.cep}<br />
                <span className="text-muted">{p.entrega.modalidade} — {p.entrega.prazo}</span>
              </p>
            </div>

            <div className="mt-11 flex flex-wrap items-center gap-6">
              <SolidBtn href={waLink(resumoWhats)} external>
                <Icon name="whatsapp" size={15} /> Acompanhar pelo WhatsApp
              </SolidBtn>
              <LinkBtn href="#/publicacoes">Continuar no catálogo</LinkBtn>
            </div>
          </div>

          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="border-t border-rule pt-7">
              <Label className="mb-7">Itens</Label>
              {p.itens.map((x) => (
                <div key={x.sku} className="flex gap-5 border-b border-rule pb-5 pt-1 [&:not(:last-of-type)]:mb-5">
                  <div className="w-14 shrink-0"><Capa item={capaDoProduto(x)} /></div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-light leading-snug text-ink">{x.titulo}</h3>
                    <p className="mt-1 font-ui text-[10px] uppercase tracking-[0.16em] text-muted">{x.qtd} × {brl(x.preco)}</p>
                  </div>
                  <span className="font-ui text-[0.9rem] tabular-nums text-ink">{brl(x.preco * x.qtd)}</span>
                </div>
              ))}
              <dl className="mt-7 space-y-3">
                <div className="flex items-baseline justify-between">
                  <dt className="font-ui text-[0.9rem] text-muted">Subtotal</dt>
                  <dd className="font-ui text-[0.9rem] tabular-nums text-ink">{brl(p.valores.subtotal)}</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="font-ui text-[0.9rem] text-muted">Entrega</dt>
                  <dd className="font-ui text-[0.9rem] tabular-nums text-ink">{p.valores.frete === 0 ? 'Grátis' : brl(p.valores.frete)}</dd>
                </div>
              </dl>
              <div className="mt-6 flex items-baseline justify-between border-t border-rule pt-6">
                <span className="font-ui text-[11px] uppercase tracking-[0.2em] text-ink">Total</span>
                <span className="font-display text-[1.9rem] font-light tabular-nums text-ink">{brl(p.valores.total)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ APP ===== */

function Paginas({ path, go }) {
  if (path === '/' || path === '') return <Home go={go} />;
  if (path === '/projetos') return <PaginaProjetos />;
  if (path === '/servicos') return <PaginaServicos />;
  if (path === '/sobre') return <PaginaSobre />;
  if (path === '/contato') return <PaginaContato />;
  if (path === '/publicacoes') return <PaginaPublicacoes />;
  if (path === '/checkout') return <PaginaCheckout go={go} />;
  if (path === '/pedido') return <PaginaPedido />;
  if (path.startsWith('/publicacoes/')) return <PaginaProduto sku={decodeURIComponent(path.split('/')[2] || '')} go={go} />;

  return (
    <section className="flex min-h-[75vh] items-center bg-paper pt-28">
      <div className="mx-auto max-w-[92rem] px-6 md:px-10 lg:px-14">
        <Label className="mb-6">Erro 404</Label>
        <h1 className="max-w-[16ch] font-display text-[clamp(2.2rem,6vw,4rem)] font-light leading-[1.04] tracking-[-0.02em] text-ink">
          Esta página não existe.
        </h1>
        <div className="mt-10"><LinkBtn href="#/">Voltar ao início</LinkBtn></div>
      </div>
    </section>
  );
}

function App() {
  const [path, go] = useRouter();
  const transparente = path === '/' || path === '';

  useEffect(() => {
    const titulos = {
      '/': '427 Design — Editora e estúdio editorial',
      '/projetos': 'Projetos — 427 Design',
      '/servicos': 'Serviços — 427 Design',
      '/publicacoes': 'Publicações — 427 Design',
      '/sobre': 'Sobre — 427 Design',
      '/contato': 'Contato — 427 Design',
      '/checkout': 'Finalizar pedido — 427 Design',
      '/pedido': 'Pedido confirmado — 427 Design',
    };
    document.title = titulos[path] || 'Publicação — 427 Design';
  }, [path]);

  return (
    <CarrinhoProvider>
      <Nav path={path} go={go} transparente={transparente} />
      <main id="conteudo">
        <Paginas path={path} go={go} />
      </main>
      <Footer />
      <CarrinhoDrawer />
      <WhatsAppFlutuante />
    </CarrinhoProvider>
  );
}

export default App;

