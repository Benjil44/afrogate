import rootPackage from '../../../package.json';
import type { ActiveView } from './dashboard-types';

export const appVersion = rootPackage.version;
export const resellerNavViews = new Set<ActiveView>(['dashboard', 'users', 'billing']);
