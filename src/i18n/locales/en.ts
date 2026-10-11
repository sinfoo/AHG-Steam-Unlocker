// Source-of-truth dictionary. Other locales are Partial<typeof en>; missing keys fall back to English.
import app from '../parts/app/en'
import ui from '../parts/ui/en'

const en = {
  ...app,
  ...ui,
  'nav.home': 'Home',
  'nav.browse': 'Browse',
  'nav.fixes': 'Fixes',
  'nav.library': 'Library',
  'nav.favourites': 'Favourites',
  'nav.recent': 'Recent',
  'nav.settings': 'Settings',
  'settings.language': 'Language',
  'settings.languageDesc': 'Choose the interface language.',
}
export default en
