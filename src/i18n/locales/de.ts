import type en from './en'
import app from '../parts/app/de'
import ui from '../parts/ui/de'

const de: Partial<typeof en> = { ...app, ...ui }
export default de
