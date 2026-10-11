import type en from './en'
import app from '../parts/app/pt'
import ui from '../parts/ui/pt'

const pt: Partial<typeof en> = { ...app, ...ui }
export default pt
