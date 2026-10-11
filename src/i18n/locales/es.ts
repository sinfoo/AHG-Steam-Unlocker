import type en from './en'
import app from '../parts/app/es'
import ui from '../parts/ui/es'

const es: Partial<typeof en> = { ...app, ...ui }
export default es
