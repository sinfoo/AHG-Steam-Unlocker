import type en from './en'
import app from '../parts/app/ar'
import ui from '../parts/ui/ar'

const ar: Partial<typeof en> = { ...app, ...ui }
export default ar
