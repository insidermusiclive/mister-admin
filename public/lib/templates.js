// Ready-made site templates. Each is just a schema; pick one, then adapt it in Settings.
const settings = (extra = []) => ({ label: 'Site settings', type: 'single', help: 'Name, contact details and logo used across the website.', fields: [
  { name: 'title', type: 'text', label: 'Website name', required: true },
  { name: 'tagline', type: 'text', label: 'Tagline' },
  { name: 'logo', type: 'image', label: 'Logo' },
  { name: 'phone', type: 'text', label: 'Phone' },
  { name: 'email', type: 'text', label: 'Email' },
  { name: 'address', type: 'textarea', label: 'Address' },
  ...extra,
] });
const navigation = { label: 'Menu', type: 'tree', titleField: 'label', help: 'The links at the top of the website. Sub-items become drop-down menus.', fields: [
  { name: 'label', type: 'text', label: 'Label', required: true },
  { name: 'url', type: 'link', label: 'Link', required: true },
] };
const hero = { label: 'Home page banner', type: 'single', fields: [
  { name: 'heading', type: 'text', label: 'Big heading', required: true },
  { name: 'text', type: 'markdown', label: 'Text' },
  { name: 'image', type: 'image', label: 'Background photo' },
  { name: 'button_label', type: 'text', label: 'Button label' },
  { name: 'button_url', type: 'link', label: 'Button link' },
] };
const social = [
  { name: 'instagram', type: 'link', label: 'Instagram' },
  { name: 'facebook', type: 'link', label: 'Facebook' },
  { name: 'youtube', type: 'link', label: 'YouTube' },
];

export const TEMPLATES = [
  {
    id: 'business', icon: '🏪', name: 'Business', blurb: 'Shop, restaurant, service. Banner, about, services, news, gallery.',
    schema: { collections: { settings: settings(), navigation, hero,
      about: { label: 'About us', type: 'single', fields: [{ name: 'heading', type: 'text', label: 'Heading' }, { name: 'text', type: 'markdown', label: 'Text' }, { name: 'photo', type: 'image', label: 'Photo' }] },
      services: { label: 'Services', type: 'list', titleField: 'name', fields: [{ name: 'name', type: 'text', label: 'Name', required: true }, { name: 'description', type: 'markdown', label: 'Description' }, { name: 'price', type: 'text', label: 'Price' }, { name: 'photo', type: 'image', label: 'Photo' }] },
      news: { label: 'News', type: 'list', titleField: 'title', fields: [{ name: 'title', type: 'text', label: 'Title', required: true }, { name: 'date', type: 'date', label: 'Date', required: true }, { name: 'body', type: 'markdown', label: 'Text' }, { name: 'image', type: 'image', label: 'Photo' }, { name: 'published', type: 'boolean', label: 'Show on website' }] },
      gallery: { label: 'Photo gallery', type: 'single', fields: [{ name: 'photos', type: 'gallery', label: 'Photos' }] },
      opening_hours: { label: 'Opening hours', type: 'list', titleField: 'day', fields: [{ name: 'day', type: 'select', label: 'Day', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], required: true }, { name: 'hours', type: 'text', label: 'Hours', help: 'e.g. 9:00 – 18:00 or Closed' }] },
    } },
  },
  {
    id: 'music', icon: '🎵', name: 'Music / Events', blurb: 'Band, label, venue, DJ. Events, releases, artists, gallery.',
    schema: { collections: { settings: settings(social), navigation, hero,
      events: { label: 'Events', type: 'list', titleField: 'name', fields: [{ name: 'name', type: 'text', label: 'Event name', required: true }, { name: 'date', type: 'date', label: 'Date', required: true }, { name: 'venue', type: 'text', label: 'Venue / city' }, { name: 'price', type: 'text', label: 'Price' }, { name: 'tickets_url', type: 'link', label: 'Ticket link' }, { name: 'description', type: 'markdown', label: 'Description' }, { name: 'poster', type: 'image', label: 'Poster / photo' }, { name: 'sold_out', type: 'boolean', label: 'Sold out' }, { name: 'published', type: 'boolean', label: 'Show on website' }] },
      releases: { label: 'Releases', type: 'list', titleField: 'title', fields: [{ name: 'title', type: 'text', label: 'Title', required: true }, { name: 'artist', type: 'text', label: 'Artist' }, { name: 'date', type: 'date', label: 'Release date' }, { name: 'cover', type: 'image', label: 'Cover' }, { name: 'listen_url', type: 'link', label: 'Listen link (Spotify, Bandcamp…)' }, { name: 'description', type: 'markdown', label: 'Description' }] },
      artists: { label: 'Artists', type: 'list', titleField: 'name', fields: [{ name: 'name', type: 'text', label: 'Name', required: true }, { name: 'bio', type: 'markdown', label: 'Biography' }, { name: 'photo', type: 'image', label: 'Photo' }, { name: 'link', type: 'link', label: 'Website / social' }] },
      gallery: { label: 'Photo gallery', type: 'single', fields: [{ name: 'photos', type: 'gallery', label: 'Photos' }] },
    } },
  },
  {
    id: 'portfolio', icon: '🎨', name: 'Portfolio', blurb: 'Photographer, artist, freelancer. Projects, about, contact.',
    schema: { collections: { settings: settings(social), navigation, hero,
      projects: { label: 'Projects', type: 'list', titleField: 'title', fields: [{ name: 'title', type: 'text', label: 'Title', required: true }, { name: 'year', type: 'number', label: 'Year', min: 1900, max: 2100 }, { name: 'category', type: 'text', label: 'Category' }, { name: 'description', type: 'markdown', label: 'Description' }, { name: 'cover', type: 'image', label: 'Cover photo' }, { name: 'photos', type: 'gallery', label: 'More photos' }, { name: 'featured', type: 'boolean', label: 'Show on home page' }] },
      about: { label: 'About me', type: 'single', fields: [{ name: 'text', type: 'markdown', label: 'Text' }, { name: 'photo', type: 'image', label: 'Photo' }] },
    } },
  },
  {
    id: 'blank', icon: '📄', name: 'Start empty', blurb: 'Only settings and a menu. Add your own sections.',
    schema: { collections: { settings: settings(), navigation } },
  },
];

export function templateById(id) { return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0]; }
