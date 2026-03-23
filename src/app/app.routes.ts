import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { Archive } from './archive/archive';
import { Bookmarks } from './bookmarks/bookmarks';


export const routes: Routes = [
  { path: '', component: Dashboard },
  { path: 'archive', component: Archive  },
  { path: 'bookmarks', component: Bookmarks }
];