import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Clock3, MapPin, MessageCircle, Phone, X } from 'lucide-react';
import paoDeQueijo from './assets/pao-de-queijo.jpg';
import bolinhoDeMandioca from './assets/bolinho-de-mandioca.jpg';
import frangoQuiabo from './assets/frango-quiabo.jpg';
import carnePanela from './assets/carne-panela.jpg';
import boloFuba from './assets/bolo-fuba.jpg';
import brigadeiro from './assets/brigadeiro.jpg';

type MenuItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  detail: string;
  price: number;
  image: string;
  imageAlt: string;
};

const items: MenuItem[] = [
  {
    id: 'pao-de-queijo',
    name: 'Pão de queijo da casa',
    category: 'Pra começar',
    description: 'Casquinha dourada, miolo macio e queijo meia-cura.',
    detail: 'Feito aqui todos os dias, com polvilho artesanal e queijo meia-cura de pequenos produtores. Vai quentinho para a mesa, do jeito que tem que ser.',
    price: 18,
    image: paoDeQueijo,
    imageAlt: 'Pães de queijo dourados servidos em prato de cerâmica',
  },
  {
    id: 'bolinho-mandioca',
    name: 'Bolinho de mandioca',
    category: 'Pra começar',
    description: 'Mandioca cremosa, recheio da estação e pimenta da casa.',
    detail: 'Mandioca cozida lentamente, temperos frescos e um recheio surpresa que muda com a feira. Crocante por fora, bem macio por dentro.',
    price: 24,
    image: bolinhoDeMandioca,
    imageAlt: 'Bolinho de mandioca crocante com molho de pimenta',
  },
  {
    id: 'frango-quiabo',
    name: 'Frango com quiabo',
    category: 'Da nossa cozinha',
    description: 'Frango caipira, quiabo fresco e polenta cremosa.',
    detail: 'Frango caipira dourado na panela, quiabo fresco sem pressa e polenta cremosa de milho amarelo. Um prato que pede mesa compartilhada.',
    price: 42,
    image: frangoQuiabo,
    imageAlt: 'Frango ensopado com quiabo e polenta cremosa',
  },
  {
    id: 'carne-panela',
    name: 'Carne de panela',
    category: 'Da nossa cozinha',
    description: 'Cozida por horas, com purê de mandioca e ervas.',
    detail: 'Acém de criação local, cebolas macias e molho encorpado de panela. Acompanha purê de mandioca feito na hora e ervas da horta.',
    price: 48,
    image: carnePanela,
    imageAlt: 'Carne de panela com purê de mandioca e ervas frescas',
  },
  {
    id: 'bolo-fuba',
    name: 'Bolo de fubá com goiabada',
    category: 'Pra adoçar',
    description: 'Fatia generosa, bolo fofinho e goiabada cascão.',
    detail: 'Nosso bolo de fubá tem casquinha dourada, interior leve e uma faixa generosa de goiabada cascão. Bom com café, melhor ainda sem pressa.',
    price: 16,
    image: boloFuba,
    imageAlt: 'Fatia de bolo de fubá caseiro com goiabada',
  },
  {
    id: 'brigadeiro',
    name: 'Brigadeiro de colher',
    category: 'Pra adoçar',
    description: 'Chocolate intenso, feito devagar e finalizado à mão.',
    detail: 'Chocolate brasileiro, leite condensado e uma pitada de sal. Mexido no fogo baixo até ficar brilhante e servido com granulado de verdade.',
    price: 14,
    image: brigadeiro,
    imageAlt: 'Brigadeiros artesanais com granulado de chocolate',
  },
];

const categories = ['Tudo', 'Pra começar', 'Da nossa cozinha', 'Pra adoçar'];
const whatsappNumber = '5500000000000';
const whatsappBase = `https://wa.me/${whatsappNumber}`;
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function PitangaMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 44 44" width="31" height="31" fill="none">
      <path d="M21.8 9.2c-3.4-4.7-9.9-3.5-10.7 1.6 4.9 1.1 8.3 1.3 10.7-1.6Z" fill="currentColor" opacity=".78" />
      <path d="M22.2 9.3c3.2-4.8 9.8-3.9 10.8 1.2-4.8 1.3-8.2 1.7-10.8-1.2Z" fill="currentColor" />
      <path d="M22 12.3v5.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 17.2c-7.4 0-13.4 4.9-13.4 11.3 0 5.6 4.3 9.1 9.4 9.1 1.8 0 3.1-.7 4-1.6.9.9 2.3 1.6 4.1 1.6 5.1 0 9.3-3.5 9.3-9.1 0-6.4-6-11.3-13.4-11.3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.1 26.7c1.2-2.7 3.6-4.2 6.1-4.6M31 26.7c-1.1-2.7-3.5-4.2-6-4.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

function App() {
  const [activeCategory, setActiveCategory] = useState('Tudo');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const visibleCategories = categories.slice(1);

  useEffect(() => {
    if (!selectedItem) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedItem(null);
      if (event.key === 'Tab') {
        const dialog = document.getElementById('product-detail-dialog');
        const focusable = dialog?.querySelectorAll<HTMLElement>('button, a[href]');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      lastTriggerRef.current?.focus();
    };
  }, [selectedItem]);

  useEffect(() => {
    const categoryBySectionId = new Map<string, string>(
      visibleCategories.map((category) => [
        `categoria-${categorySlug(category)}`,
        category,
      ] as const),
    );
    const sections = [...categoryBySectionId.keys()]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section instanceof HTMLElement);

    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      const currentSection = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const category = currentSection
        ? categoryBySectionId.get(currentSection.target.id)
        : undefined;
      if (category) setActiveCategory(category);
    }, { rootMargin: '-130px 0px -55% 0px', threshold: 0 });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateScrollState = () => {
      const isPastIntro = window.scrollY > 480;
      setShowBackToTop((current) => current === isPastIntro ? current : isPastIntro);
      if (window.scrollY <= 140) {
        setActiveCategory((current) => current === 'Tudo' ? current : 'Tudo');
      }
    };

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  const goToCategory = (category: string) => {
    setActiveCategory(category);
    const targetId = category === 'Tudo'
      ? 'menu'
      : `categoria-${categorySlug(category)}`;
    document.getElementById(targetId)?.scrollIntoView({
      behavior: preferredScrollBehavior(),
      block: 'start',
    });
  };

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#inicio" aria-label="Bistrô Pitanga, início" data-testid="link-home">
            <span className="brand-mark"><PitangaMark /></span>
            <span><span className="brand-name">Bistrô Pitanga</span><span className="brand-kicker">comida de casa, feita aqui</span></span>
          </a>
          <a className="top-link" href="#cardapio" data-testid="link-cardapio-topo">Ver cardápio <ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
      </header>

      <main id="inicio">
        <section className="hero-wrap" aria-labelledby="hero-title" data-testid="section-apresentacao">
          <div className="hero">
            <div className="hero-copy">
              <span className="eyebrow">Cozinha de afeto, todo dia</span>
              <h1 id="hero-title">Um lugar gostoso de chamar de seu.</h1>
              <p>Receitas brasileiras, ingredientes fresquinhos e aquele cuidado que dá para sentir em cada garfada.</p>
              <div className="quick-facts" aria-label="Informações do restaurante">
                <span><Clock3 size={14} aria-hidden="true" /> Ter a dom · 11h30 às 22h</span>
                <span><MapPin size={14} aria-hidden="true" /> Vila Madalena, SP</span>
              </div>
            </div>
            <div className="hero-note" aria-label="Feito com carinho"><strong>de verdade</strong>feito com carinho</div>
          </div>
        </section>

        <section id="cardapio" className="menu-wrap" aria-labelledby="menu-title" data-testid="section-cardapio">
          <div id="menu" className="menu-heading">
            <div>
              <h2 id="menu-title" className="serif">À mesa</h2>
              <p>Um pedacinho da nossa cozinha para você.</p>
            </div>
            <span className="eyebrow" style={{ color: '#728173' }}>feito na casa</span>
          </div>

          <nav className="category-bar" aria-label="Categorias do cardápio" data-testid="nav-categorias">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`category-button${activeCategory === category ? ' active' : ''}`}
                aria-pressed={activeCategory === category}
                data-testid={`button-categoria-${categorySlug(category)}`}
                onClick={() => goToCategory(category)}
              >
                {category}
              </button>
            ))}
          </nav>

          {visibleCategories.map((category) => {
            const categoryItems = items.filter((item) => item.category === category);
            return (
              <section id={`categoria-${categorySlug(category)}`} className="menu-group" key={category} aria-labelledby={`heading-${categorySlug(category)}`} data-testid={`group-categoria-${categorySlug(category)}`}>
                <div className="group-heading">
                  <h3 id={`heading-${categorySlug(category)}`}>{category}</h3>
                  <span>{categoryItems.length} {categoryItems.length === 1 ? 'delícia' : 'delícias'}</span>
                </div>
                <div className="product-grid">
                  {categoryItems.map((item) => (
                    <button
                      type="button"
                      className="product-card"
                      key={item.id}
                      aria-label={`Ver detalhes de ${item.name}, ${money(item.price)}`}
                      data-testid={`button-produto-${item.id}`}
                      onClick={(event) => {
                        lastTriggerRef.current = event.currentTarget;
                        setSelectedItem(item);
                      }}
                    >
                      <img className="product-photo" src={item.image} alt={item.imageAlt} loading="lazy" data-testid={`img-produto-${item.id}`} />
                      <span className="product-copy">
                        <span className="product-title-row">
                          <span className="product-title">{item.name}</span>
                          <ArrowUpRight className="product-arrow" size={15} aria-hidden="true" />
                        </span>
                        <span className="product-description">{item.description}</span>
                        <span className="product-price" data-testid={`text-preco-${item.id}`}>{money(item.price)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}

          <aside className="fresh-note" data-testid="note-ingredientes">
            <span className="fresh-icon"><ArrowDown size={18} aria-hidden="true" /></span>
            <span><strong>O que vem da feira, vem fresquinho.</strong><p>Nosso cardápio acompanha a estação. Pergunte pelo prato do dia quando falar com a gente.</p></span>
          </aside>
        </section>
      </main>

      <footer id="contato" className="contact-section" data-testid="section-contato">
        <div className="contact-inner">
          <div>
            <h2 className="contact-title">A gente espera por você.</h2>
            <p className="contact-sub">Rua Harmonia, 184 · Vila Madalena, São Paulo — SP</p>
          </div>
          <div className="contact-links">
            <a className="contact-link" href="tel:+5500000000000" data-testid="link-telefone">
              <Phone size={17} aria-hidden="true" /><span><small>Ligue para nós</small><strong>+55 (00) 00000-0000</strong></span>
            </a>
            <a className="contact-link" href={`${whatsappBase}?text=${encodeURIComponent('Oi! Quero saber mais sobre o cardápio do Bistrô Pitanga.')}`} target="_blank" rel="noopener noreferrer" data-testid="link-whatsapp-contato">
              <MessageCircle size={17} aria-hidden="true" /><span><small>WhatsApp</small><strong>+55 (00) 00000-0000</strong></span>
            </a>
          </div>
        </div>
        <div className="contact-bottom">Bistrô Pitanga · Feito com cuidado na Vila Madalena <span aria-label="número fictício">· Contatos fictícios para demonstração</span></div>
      </footer>

      {selectedItem && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedItem(null); }} data-testid="overlay-detalhes">
          <section
            id="product-detail-dialog"
            className="detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description"
            data-testid={`dialog-produto-${selectedItem.id}`}
          >
            <img className="dialog-image" src={selectedItem.image} alt={selectedItem.imageAlt} />
            <button ref={closeButtonRef} className="dialog-close" type="button" onClick={() => setSelectedItem(null)} aria-label="Fechar detalhes do prato" data-testid="button-fechar-detalhes">
              <X size={19} aria-hidden="true" />
            </button>
            <div className="dialog-content">
              <span className="dialog-category">{selectedItem.category}</span>
              <h2 id="dialog-title">{selectedItem.name}</h2>
              <p className="dialog-description" id="dialog-description">{selectedItem.detail}</p>
              <div className="dialog-price-row"><span>Uma porção feita na hora</span><span className="dialog-price">{money(selectedItem.price)}</span></div>
              <a
                className="whatsapp-cta"
                href={`${whatsappBase}?text=${encodeURIComponent(`Oi! Tenho interesse no ${selectedItem.name} do Bistrô Pitanga.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`link-whatsapp-produto-${selectedItem.id}`}
              >
                <MessageCircle size={17} aria-hidden="true" /> Perguntar pelo WhatsApp
              </a>
              <p className="demo-caption">Contato fictício para demonstração</p>
            </div>
          </section>
        </div>
      )}

      {showBackToTop && (
        <button
          className="back-to-top"
          type="button"
          aria-label="Voltar ao topo"
          data-testid="button-voltar-ao-topo"
          onClick={() => window.scrollTo({ top: 0, behavior: preferredScrollBehavior() })}
        >
          <ArrowUp size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

function categorySlug(category: string) {
  return category.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll(' ', '-');
}

export default App;
