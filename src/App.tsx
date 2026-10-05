import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Clock3, MapPin, MessageCircle, Phone, X } from 'lucide-react';
import AdminApp from './admin/AdminApp';
import { menuData } from './data/menu';
import { loadPublicMenuData, type PublicMenuResult } from './data/menuRepository';
import type { MenuItem } from './types/menu';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const updatePathname = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', updatePathname);
    return () => window.removeEventListener('popstate', updatePathname);
  }, []);

  if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin/dashboard') {
    return <AdminApp pathname={pathname} />;
  }

  return <PublicMenuApp />;
}

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

function PublicMenuApp() {
  const [menuResult, setMenuResult] = useState<PublicMenuResult | undefined>(undefined);
  const [activeCategory, setActiveCategory] = useState('Tudo');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menu = menuResult?.status === 'ready' ? menuResult.data : menuData;
  const { restaurant, contacts, categories: menuCategories, items } = menu;
  const categories = ['Tudo', ...menuCategories.map((category) => category.name)];
  const whatsappBase = `https://wa.me/${contacts.whatsapp.number}`;
  const visibleCategories = menuCategories;
  const selectedCategory = selectedItem
    ? menuCategories.find((category) => category.id === selectedItem.categoryId)
    : undefined;

  useEffect(() => {
    let isCurrent = true;
    void loadPublicMenuData().then((loadedMenu) => {
      if (isCurrent) setMenuResult(loadedMenu);
    });
    return () => {
      isCurrent = false;
    };
  }, []);

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
        `categoria-${categorySlug(category.name)}`,
        category.name,
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
  }, [visibleCategories]);

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

  if (menuResult === undefined) {
    return <main className="menu-availability-state" role="status">Carregando cardápio…</main>;
  }

  if (menuResult.status === 'no-selection') {
    return (
      <main className="menu-availability-state" role="status">
        Nenhum restaurante selecionado. Acesse este cardápio com ?restaurante=slug.
      </main>
    );
  }

  if (menuResult.status === 'unavailable') {
    return (
      <main className="menu-availability-state" role="status">
        Este cardápio está indisponível no momento.
      </main>
    );
  }

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
          <a className="brand" href="#inicio" aria-label={`${restaurant.name}, início`} data-testid="link-home">
            <span className="brand-mark">
              {restaurant.logoUrl
                ? <img src={restaurant.logoUrl} alt="" />
                : <PitangaMark />}
            </span>
            <span><span className="brand-name">{restaurant.name}</span><span className="brand-kicker">{restaurant.brandTagline}</span></span>
          </a>
          <a className="top-link" href="#cardapio" data-testid="link-cardapio-topo">Ver cardápio <ArrowUpRight size={14} aria-hidden="true" /></a>
        </div>
      </header>

      <main id="inicio">
        <section className="hero-wrap" aria-labelledby="hero-title" data-testid="section-apresentacao">
          <div className="hero">
            <div className="hero-copy">
              <span className="eyebrow">{restaurant.heroEyebrow}</span>
              <h1 id="hero-title">{restaurant.heroTitle}</h1>
              <p>{restaurant.heroDescription}</p>
              <div className="quick-facts" aria-label="Informações do restaurante">
                <span><Clock3 size={14} aria-hidden="true" /> {restaurant.openingHours}</span>
                <span><MapPin size={14} aria-hidden="true" /> {restaurant.location}</span>
              </div>
            </div>
            <div className="hero-note" aria-label="Feito com carinho"><strong>{restaurant.heroNoteTitle}</strong>{restaurant.heroNoteDescription}</div>
          </div>
        </section>

        <section id="cardapio" className="menu-wrap" aria-labelledby="menu-title" data-testid="section-cardapio">
          <div id="menu" className="menu-heading">
            <div>
              <h2 id="menu-title" className="serif">{restaurant.menuTitle}</h2>
              <p>{restaurant.menuDescription}</p>
            </div>
            <span className="eyebrow" style={{ color: '#728173' }}>{restaurant.menuBadge}</span>
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
            const categoryItems = items.filter((item) => item.categoryId === category.id);
            return (
              <section id={`categoria-${categorySlug(category.name)}`} className="menu-group" key={category.id} aria-labelledby={`heading-${categorySlug(category.name)}`} data-testid={`group-categoria-${categorySlug(category.name)}`}>
                <div className="group-heading">
                  <h3 id={`heading-${categorySlug(category.name)}`}>{category.name}</h3>
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
                      {item.image ? (
                        <img className="product-photo" src={item.image} alt={item.imageAlt} loading="lazy" data-testid={`img-produto-${item.id}`} />
                      ) : (
                        <span className="product-photo" aria-hidden="true" />
                      )}
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
            <span><strong>{restaurant.seasonalNoteTitle}</strong><p>{restaurant.seasonalNoteDescription}</p></span>
          </aside>
        </section>
      </main>

      <footer id="contato" className="contact-section" data-testid="section-contato">
        <div className="contact-inner">
          <div>
            <h2 className="contact-title">{restaurant.contactTitle}</h2>
            <p className="contact-sub">{restaurant.address}</p>
          </div>
          <div className="contact-links">
            {contacts.phone.href && (
              <a className="contact-link" href={contacts.phone.href} data-testid="link-telefone">
                <Phone size={17} aria-hidden="true" /><span><small>{contacts.phone.label}</small><strong>{contacts.phone.displayValue}</strong></span>
              </a>
            )}
            {contacts.whatsapp.number && (
              <a className="contact-link" href={`${whatsappBase}?text=${encodeURIComponent(contacts.whatsapp.generalMessage)}`} target="_blank" rel="noopener noreferrer" data-testid="link-whatsapp-contato">
                <MessageCircle size={17} aria-hidden="true" /><span><small>{contacts.whatsapp.label}</small><strong>{contacts.whatsapp.displayValue}</strong></span>
              </a>
            )}
          </div>
        </div>
        <div className="contact-bottom">
          {restaurant.name} · {restaurant.footerDescription}
          {restaurant.footerDisclaimer && <span aria-label="número fictício"> · {restaurant.footerDisclaimer}</span>}
        </div>
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
            {selectedItem.image ? (
              <img className="dialog-image" src={selectedItem.image} alt={selectedItem.imageAlt} />
            ) : (
              <div className="dialog-image" aria-hidden="true" />
            )}
            <button ref={closeButtonRef} className="dialog-close" type="button" onClick={() => setSelectedItem(null)} aria-label="Fechar detalhes do prato" data-testid="button-fechar-detalhes">
              <X size={19} aria-hidden="true" />
            </button>
            <div className="dialog-content">
              <span className="dialog-category">{selectedCategory?.name}</span>
              <h2 id="dialog-title">{selectedItem.name}</h2>
              <p className="dialog-description" id="dialog-description">{selectedItem.detail}</p>
              <div className="dialog-price-row"><span>{restaurant.portionDescription}</span><span className="dialog-price">{money(selectedItem.price)}</span></div>
              {contacts.whatsapp.number && (
                <a
                  className="whatsapp-cta"
                  href={`${whatsappBase}?text=${encodeURIComponent(`${contacts.whatsapp.productMessagePrefix}${selectedItem.name}${contacts.whatsapp.productMessageSuffix}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`link-whatsapp-produto-${selectedItem.id}`}
                >
                  <MessageCircle size={17} aria-hidden="true" /> {contacts.whatsapp.ctaLabel}
                </a>
              )}
              <p className="demo-caption">{restaurant.productContactNotice}</p>
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
