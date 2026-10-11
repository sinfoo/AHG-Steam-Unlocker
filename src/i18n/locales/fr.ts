import type en from './en'
import app from '../parts/app/fr'
import ui from '../parts/ui/fr'

const fr: Partial<typeof en> = { ...app, ...ui }
export default fr
