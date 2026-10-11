import type en from './en'
import app from '../parts/app/zh'
import ui from '../parts/ui/zh'

const zh: Partial<typeof en> = { ...app, ...ui }
export default zh
