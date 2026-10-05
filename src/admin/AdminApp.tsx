import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import './admin.css';

type AdminAssociation = {
  restaurant_id: string;
  role: 'owner' | 'admin';
};

type Restaurant = {
  id: string;
  name: string;
  is_public: boolean;
};

type Category = {
  id: string;
  name: string;
  sort_order: number;
};

type Product = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  detail: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
};

type DashboardData = {
  restaurant: Restaurant;
  categories: Category[];
  products: Product[];
};

type CategoryOperation = 'create' | `update:${string}` | `delete:${string}` | null;

type MembershipState =
  | { status: 'idle' | 'loading' }
  | { status: 'denied' }
  | { status: 'multiple' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: DashboardData };

function navigate(pathname: string) {
  window.history.pushState({}, '', pathname);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
}

function AdminApp({ pathname }: { pathname: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [membership, setMembership] = useState<MembershipState>({ status: 'idle' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryOrder, setCategoryOrder] = useState('0');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryOperation, setCategoryOperation] = useState<CategoryOperation>(null);
  const [categoryMessage, setCategoryMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const authEventVersion = useRef(0);
  const isDashboardPath = pathname === '/admin/dashboard';

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let isCurrent = true;
    const initialVersion = authEventVersion.current;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventVersion.current += 1;
      if (isCurrent) {
        setSession(nextSession);
        setMembership({ status: 'idle' });
        setAuthLoading(false);
        setAuthError('');
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isCurrent || authEventVersion.current !== initialVersion) return;
      if (error) {
        setAuthError('Não foi possível verificar a sessão. Tente novamente.');
      } else {
        setSession(data.session);
      }
      setAuthLoading(false);
    }).catch((error: unknown) => {
      if (!isCurrent || authEventVersion.current !== initialVersion) return;
      setAuthError(`Não foi possível verificar a sessão: ${getErrorMessage(error)}`);
      setAuthLoading(false);
    });

    return () => {
      isCurrent = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session) {
      setMembership({ status: 'idle' });
      return;
    }

    let isCurrent = true;
    setMembership({ status: 'loading' });

    void (async () => {
      try {
        const { data: associations, error: associationError } = await supabase
          .from('restaurant_admins')
          .select('restaurant_id, role')
          .returns<AdminAssociation[]>()
          .eq('user_id', session.user.id);

        if (associationError) throw associationError;
        if (!associations?.length) {
          if (isCurrent) setMembership({ status: 'denied' });
          return;
        }
        if (associations.length !== 1) {
          if (isCurrent) setMembership({ status: 'multiple' });
          return;
        }

        const restaurantId = associations[0].restaurant_id;
        const [restaurantResult, categoriesResult, productsResult] = await Promise.all([
          supabase
            .from('restaurants')
            .select('id, name, is_public')
            .returns<Restaurant[]>()
            .eq('id', restaurantId)
            .maybeSingle(),
          supabase
            .from('categories')
            .select('id, name, sort_order')
            .returns<Category[]>()
            .eq('restaurant_id', restaurantId)
            .order('sort_order'),
          supabase
            .from('products')
            .select('id, category_id, name, description, detail, price, image_url, is_available, sort_order')
            .returns<Product[]>()
            .eq('restaurant_id', restaurantId)
            .order('sort_order'),
        ]);

        if (restaurantResult.error) throw restaurantResult.error;
        if (categoriesResult.error) throw categoriesResult.error;
        if (productsResult.error) throw productsResult.error;
        if (!restaurantResult.data) {
          if (isCurrent) {
            setMembership({
              status: 'error',
              message: 'O restaurante associado não está disponível para esta conta.',
            });
          }
          return;
        }

        if (isCurrent) {
          setMembership({
            status: 'ready',
            data: {
              restaurant: restaurantResult.data,
              categories: categoriesResult.data ?? [],
              products: productsResult.data ?? [],
            },
          });
        }
      } catch (error) {
        if (isCurrent) {
          setMembership({
            status: 'error',
            message: `Não foi possível carregar os dados autorizados: ${getErrorMessage(error)}`,
          });
        }
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [session]);

  useEffect(() => {
    if (authLoading) return;
    if (isDashboardPath && !session) navigate('/admin');
    if (!isDashboardPath && session && membership.status === 'ready') navigate('/admin/dashboard');
  }, [authLoading, isDashboardPath, membership.status, session]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setSigningIn(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/admin/dashboard');
    } catch (error) {
      setAuthError(`Não foi possível entrar: ${getErrorMessage(error)}`);
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;

    setSigningOut(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setMembership({ status: 'idle' });
      navigate('/admin');
    } catch (error) {
      setAuthError(`Não foi possível encerrar a sessão: ${getErrorMessage(error)}`);
    } finally {
      setSigningOut(false);
    }
  };

  const resetCategoryForm = () => {
    setCategoryName('');
    setCategoryOrder('0');
    setEditingCategoryId(null);
    setShowCategoryForm(false);
  };

  const updateCategoryList = (
    restaurantId: string,
    update: (categories: Category[]) => Category[],
    updateProducts: (products: Product[]) => Product[] = (products) => products,
  ) => {
    setMembership((current) => {
      if (current.status !== 'ready' || current.data.restaurant.id !== restaurantId) return current;
      return {
        ...current,
        data: {
          ...current.data,
          categories: update(current.data.categories).sort((a, b) => a.sort_order - b.sort_order),
          products: updateProducts(current.data.products),
        },
      };
    });
  };

  const handleCategorySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || membership.status !== 'ready') return;

    const name = categoryName.trim();
    const orderInput = categoryOrder.trim();
    if (!orderInput) {
      setCategoryMessage({ type: 'error', text: 'Informe a ordem da categoria.' });
      return;
    }
    const sortOrder = Number(orderInput);
    if (!name) {
      setCategoryMessage({ type: 'error', text: 'Informe o nome da categoria.' });
      return;
    }
    if (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder) || sortOrder < 0) {
      setCategoryMessage({ type: 'error', text: 'A ordem deve ser um número inteiro igual ou maior que zero.' });
      return;
    }

    const { restaurant } = membership.data;
    const editingId = editingCategoryId;
    const operation: CategoryOperation = editingId ? `update:${editingId}` : 'create';
    setCategoryOperation(operation);
    setCategoryMessage(null);

    try {
      let savedCategory: Category;
      if (editingId) {
        const { data, error } = await supabase
          .from('categories')
          .update({ name, sort_order: sortOrder })
          .eq('id', editingId)
          .eq('restaurant_id', restaurant.id)
          .select('id, name, sort_order')
          .returns<Category[]>()
          .single();
        if (error) throw error;
        savedCategory = data;
      } else {
        const { data, error } = await supabase
          .from('categories')
          .insert({
            restaurant_id: restaurant.id,
            name,
            sort_order: sortOrder,
          })
          .select('id, name, sort_order')
          .returns<Category[]>()
          .single();
        if (error) throw error;
        savedCategory = data;
      }

      updateCategoryList(restaurant.id, (categories) => editingId
        ? categories.map((category) => category.id === editingId ? savedCategory : category)
        : [...categories, savedCategory]);
      resetCategoryForm();
      setCategoryMessage({
        type: 'success',
        text: editingId ? 'Categoria atualizada.' : 'Categoria criada.',
      });
    } catch (error) {
      setCategoryMessage({
        type: 'error',
        text: `Não foi possível salvar a categoria: ${getErrorMessage(error)}`,
      });
    } finally {
      setCategoryOperation(null);
    }
  };

  const beginCategoryEdit = (category: Category) => {
    setEditingCategoryId(category.id);
    setCategoryName(category.name);
    setCategoryOrder(String(category.sort_order));
    setShowCategoryForm(true);
    setCategoryMessage(null);
  };

  const handleCategoryDelete = async (category: Category) => {
    if (!supabase || membership.status !== 'ready') return;
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) return;

    const restaurantId = membership.data.restaurant.id;
    setCategoryOperation(`delete:${category.id}`);
    setCategoryMessage(null);

    try {
      const { data, error } = await supabase
        .from('categories')
        .delete()
        .eq('id', category.id)
        .eq('restaurant_id', restaurantId)
        .select('id')
        .returns<Array<Pick<Category, 'id'>>>()
        .single();
      if (error) throw error;
      if (!data) throw new Error('A categoria não foi encontrada neste restaurante.');

      updateCategoryList(
        restaurantId,
        (categories) => categories.filter((item) => item.id !== data.id),
        (products) => products.map((product) => product.category_id === data.id
          ? { ...product, category_id: null }
          : product),
      );
      setCategoryMessage({ type: 'success', text: 'Categoria excluída.' });
    } catch (error) {
      setCategoryMessage({
        type: 'error',
        text: `Não foi possível excluir a categoria: ${getErrorMessage(error)}`,
      });
    } finally {
      setCategoryOperation(null);
    }
  };

  if (authLoading || (session && membership.status === 'idle')) {
    return <main className="admin-page"><p className="admin-message">Verificando sessão…</p></main>;
  }

  if (!supabase) {
    return (
      <main className="admin-page">
        <section className="admin-panel" aria-labelledby="admin-title">
          <p className="admin-eyebrow">Área restrita</p>
          <h1 id="admin-title">Painel administrativo</h1>
          <p className="admin-message">O Supabase não está configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para habilitar o acesso.</p>
          <a className="admin-secondary-link" href="/">Voltar ao cardápio</a>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="admin-page">
        <section className="admin-panel" aria-labelledby="admin-title">
          <p className="admin-eyebrow">Área restrita</p>
          <h1 id="admin-title">Entrar no painel</h1>
          <form className="admin-form" onSubmit={handleLogin}>
            <label htmlFor="admin-email">E-mail</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="admin-password">Senha</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {authError && <p className="admin-error" role="alert">{authError}</p>}
            <button className="admin-primary-button" type="submit" disabled={signingIn}>
              {signingIn ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          <a className="admin-secondary-link" href="/">Voltar ao cardápio</a>
        </section>
      </main>
    );
  }

  if (membership.status === 'loading' || membership.status === 'idle') {
    return <main className="admin-page"><p className="admin-message">Verificando acesso ao restaurante…</p></main>;
  }

  if (membership.status === 'denied' || membership.status === 'multiple' || membership.status === 'error') {
    const message = membership.status === 'denied'
      ? 'Esta conta não possui associação a um restaurante. O acesso ao painel foi negado.'
      : membership.status === 'multiple'
        ? 'Esta conta possui mais de uma associação. O painel inicial aceita uma associação por usuário.'
        : membership.message;

    return (
      <main className="admin-page">
        <section className="admin-panel" aria-labelledby="admin-title">
          <p className="admin-eyebrow">Acesso restrito</p>
          <h1 id="admin-title">Acesso não disponível</h1>
          <p className="admin-error" role="alert">{message}</p>
          {authError && <p className="admin-error" role="alert">{authError}</p>}
          <button className="admin-secondary-button" type="button" onClick={() => void handleLogout()} disabled={signingOut}>
            {signingOut ? 'Saindo…' : 'Sair'}
          </button>
        </section>
      </main>
    );
  }

  if (!isDashboardPath) {
    return <main className="admin-page"><p className="admin-message">Redirecionando para o painel…</p></main>;
  }

  const { restaurant, categories, products } = membership.data;
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <main className="admin-page">
      <div className="admin-dashboard">
        <header className="admin-dashboard-header">
          <div>
            <p className="admin-eyebrow">Painel administrativo</p>
            <h1>{restaurant.name}</h1>
            <span className={`admin-status ${restaurant.is_public ? 'is-public' : 'is-private'}`}>
              {restaurant.is_public ? 'Público' : 'Privado'}
            </span>
          </div>
          <button className="admin-secondary-button" type="button" onClick={() => void handleLogout()} disabled={signingOut}>
            {signingOut ? 'Saindo…' : 'Sair'}
          </button>
        </header>

        {authError && <p className="admin-error" role="alert">{authError}</p>}

        <section className="admin-section" aria-labelledby="admin-categories-title">
          <div className="admin-section-heading">
            <h2 id="admin-categories-title">Categorias</h2>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={categoryOperation !== null}
              onClick={() => {
                if (showCategoryForm) {
                  resetCategoryForm();
                } else {
                  setCategoryName('');
                  setCategoryOrder('0');
                  setEditingCategoryId(null);
                  setShowCategoryForm(true);
                }
                setCategoryMessage(null);
              }}
            >
              {showCategoryForm ? 'Cancelar' : 'Nova categoria'}
            </button>
          </div>
          {categoryMessage && (
            <p className={`admin-feedback is-${categoryMessage.type}`} role={categoryMessage.type === 'error' ? 'alert' : 'status'}>
              {categoryMessage.text}
            </p>
          )}
          {showCategoryForm && (
            <form className="admin-form admin-category-form" onSubmit={(event) => void handleCategorySubmit(event)}>
              <label htmlFor="admin-category-name">Nome</label>
              <input
                id="admin-category-name"
                type="text"
                required
                maxLength={120}
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                disabled={categoryOperation !== null}
              />
              <label htmlFor="admin-category-order">Ordem</label>
              <input
                id="admin-category-order"
                type="number"
                min="0"
                step="1"
                required
                value={categoryOrder}
                onChange={(event) => setCategoryOrder(event.target.value)}
                disabled={categoryOperation !== null}
              />
              <div className="admin-category-form-actions">
                <button className="admin-primary-button" type="submit" disabled={categoryOperation !== null}>
                  {categoryOperation === 'create' || categoryOperation?.startsWith('update:')
                    ? 'Salvando…'
                    : editingCategoryId ? 'Salvar alterações' : 'Criar categoria'}
                </button>
                <button className="admin-secondary-button" type="button" onClick={resetCategoryForm} disabled={categoryOperation !== null}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
          {categories.length ? (
            <ul className="admin-list">
              {categories.map((category) => (
                <li className="admin-list-row" key={category.id}>
                  <span>{category.name}</span>
                  <span className="admin-category-actions">
                    <span className="admin-sort-order">Ordem {category.sort_order}</span>
                    <button
                      className="admin-category-action"
                      type="button"
                      disabled={categoryOperation !== null}
                      onClick={() => beginCategoryEdit(category)}
                    >
                      Editar
                    </button>
                    <button
                      className="admin-category-action is-danger"
                      type="button"
                      disabled={categoryOperation !== null}
                      onClick={() => void handleCategoryDelete(category)}
                    >
                      {categoryOperation === `delete:${category.id}` ? 'Excluindo…' : 'Excluir'}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-message">Nenhuma categoria cadastrada.</p>
          )}
        </section>

        <section className="admin-section" aria-labelledby="admin-products-title">
          <h2 id="admin-products-title">Produtos</h2>
          {products.length ? (
            <ul className="admin-list">
              {products.map((product) => (
                <li className="admin-list-row admin-product-row" key={product.id}>
                  <span className="admin-product-details">
                    <strong>{product.name}</strong>
                    <span>{product.description || product.detail || 'Sem descrição.'}</span>
                    <span>{product.category_id ? categoryNames.get(product.category_id) ?? 'Categoria indisponível' : 'Sem categoria'}</span>
                  </span>
                  <span className="admin-product-meta">
                    <strong>{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    <span>{product.is_available ? 'Disponível' : 'Indisponível'} · Ordem {product.sort_order}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="admin-message">Nenhum produto cadastrado.</p>}
        </section>
      </div>
    </main>
  );
}

export default AdminApp;
