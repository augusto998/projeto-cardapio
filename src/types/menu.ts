export type MenuCategory = {
  id: string;
  name: string;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  detail: string;
  price: number;
  image: string;
  imageAlt: string;
};

export type RestaurantInfo = {
  name: string;
  brandTagline: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  openingHours: string;
  location: string;
  heroNoteTitle: string;
  heroNoteDescription: string;
  menuTitle: string;
  menuDescription: string;
  menuBadge: string;
  seasonalNoteTitle: string;
  seasonalNoteDescription: string;
  contactTitle: string;
  address: string;
  footerDescription: string;
  footerDisclaimer: string;
  portionDescription: string;
  productContactNotice: string;
};

export type PhoneContact = {
  label: string;
  displayValue: string;
  href: string;
};

export type WhatsAppContact = {
  label: string;
  displayValue: string;
  number: string;
  ctaLabel: string;
  generalMessage: string;
  productMessagePrefix: string;
  productMessageSuffix: string;
};

export type RestaurantContacts = {
  phone: PhoneContact;
  whatsapp: WhatsAppContact;
};

export type PublicMenuData = {
  restaurant: RestaurantInfo;
  contacts: RestaurantContacts;
  categories: MenuCategory[];
  items: MenuItem[];
};