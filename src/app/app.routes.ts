import { Routes } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';
import { Archive } from './components/archive/archive';
import { Bookmarks } from './components/bookmarks/bookmarks';


export const routes: Routes = [
  { path: '', component: Dashboard },
  { path: 'archive', component: Archive  },
  { path: 'bookmarks', component: Bookmarks }
];