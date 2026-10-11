import type en from './en'
import app from '../parts/app/tr'
import ui from '../parts/ui/tr'

const tr: Partial<typeof en> = { ...app, ...ui }
export default tr
