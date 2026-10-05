import { supabase } from '../lib/supabase';
import { menuData } from './menu';
import type { MenuCategory, MenuItem, PublicMenuData } from '../types/menu';

type RestaurantRow = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  telefone: string | null;
  whatsapp: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
};

type ProductRow = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  detail: string | null;
  price: number;
  is_available: boolean;
  image_url: string | null;
  image_alt: string | null;
  sort_order: number;
};

export type PublicMenuResult =
  | { status: 'ready'; data: PublicMenuData }
  | { status: 'no-selection' }
  | { status: 'unavailable' };

const digitsOnly = (value: string) => value.replace(/\D/g, '');

export async function loadPublicMenuData(): Promise<PublicMenuResult> {
  if (!supabase) return { status: 'ready', data: menuData };

  const searchParams = new URLSearchParams(window.location.search);
  const restaurantSlug = searchParams.has('restaurante')
    ? searchParams.get('restaurante')?.trim()
    : import.meta.env.VITE_SUPABASE_RESTAURANT_SLUG?.trim();
  if (!restaurantSlug) return { status: 'no-selection' };

  try {
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('id, name, description, logo_url, telefone, whatsapp')
      .returns<RestaurantRow[]>()
      .eq('slug', restaurantSlug)
      .eq('is_public', true)
      .maybeSingle();

    if (restaurantError) throw restaurantError;
    if (!restaurant) return { status: 'unavailable' };

    const [categoriesResult, productsResult] = await Promise.all([
      supabase
        .from('categories')
        .select('id, name, sort_order')
        .returns<CategoryRow[]>()
        .eq('restaurant_id', restaurant.id)
        .order('sort_order'),
      supabase
        .from('products')
        .select('id, category_id, name, description, detail, price, is_available, image_url, image_alt, sort_order')
        .returns<ProductRow[]>()
        .eq('restaurant_id', restaurant.id)
        .eq('is_available', true)
        .not('category_id', 'is', null)
        .order('sort_order'),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (productsResult.error) throw productsResult.error;

    const categories: MenuCategory[] = (categoriesResult.data ?? []).map(({ id, name, sort_order }) => ({
      id,
      name,
      sortOrder: sort_order,
    }));
    const items: MenuItem[] = (productsResult.data ?? [])
      .filter((product): product is ProductRow & { category_id: string } => product.category_id !== null)
      .map((product) => ({
        id: product.id,
        categoryId: product.category_id,
        name: product.name,
        description: product.description ?? '',
        detail: product.detail ?? '',
        price: product.price,
        isAvailable: product.is_available,
        sortOrder: product.sort_order,
        image: product.image_url ?? '',
        imageAlt: product.image_alt ?? product.name,
      }));

    const phone = restaurant.telefone?.trim() ?? '';
    const phoneDigits = digitsOnly(phone);
    const whatsapp = restaurant.whatsapp?.trim() ?? '';
    const whatsappNumber = digitsOnly(whatsapp);
    const restaurantCopy = menuData.restaurant;

    return {
      status: 'ready',
      data: {
        restaurant: {
          ...restaurantCopy,
          name: restaurant.name,
          logoUrl: restaurant.logo_url ?? undefined,
          brandTagline: 'Cardápio do restaurante',
          heroEyebrow: 'Confira o cardápio',
          heroDescription: restaurant.description ?? 'Conheça os produtos disponíveis neste restaurante.',
          openingHours: 'Consulte os horários com o restaurante.',
          location: 'Endereço não informado.',
          menuDescription: 'Conheça as opções disponíveis.',
          seasonalNoteTitle: 'Consulte a disponibilidade dos produtos.',
          seasonalNoteDescription: 'Os produtos exibidos estão disponíveis no momento da consulta.',
          contactTitle: 'Fale com o restaurante.',
          address: 'Endereço não informado.',
          footerDescription: 'Cardápio do restaurante',
          footerDisclaimer: '',
          portionDescription: 'Preço do produto',
          productContactNotice: whatsappNumber
            ? 'Consulte o restaurante para mais informações.'
            : 'Consulte os contatos disponíveis do restaurante.',
        },
        contacts: {
          phone: {
            ...menuData.contacts.phone,
            displayValue: phoneDigits ? phone : 'Não informado',
            href: phoneDigits ? `tel:${phoneDigits}` : '',
          },
          whatsapp: {
            ...menuData.contacts.whatsapp,
            displayValue: whatsappNumber ? whatsapp : 'Não informado',
            number: whatsappNumber,
            generalMessage: `Oi! Quero saber mais sobre o cardápio do ${restaurant.name}.`,
            productMessageSuffix: ` do ${restaurant.name}.`,
          },
        },
        categories,
        items,
      },
    };
  } catch (error) {
    console.error('Não foi possível carregar o cardápio público do Supabase.', error);
    return { status: 'unavailable' };
  }
}
