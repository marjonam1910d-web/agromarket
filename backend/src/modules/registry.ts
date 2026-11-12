import type { AppModule } from './types';
import auth from './auth';
import users from './users';
import categories from './categories';
import products from './products';
import sellers from './sellers';
import cart from './cart';
import orders from './orders';
import payments from './payments';
import delivery from './delivery';
import reviews from './reviews';
import favorites from './favorites';
import notifications from './notifications';
import chat from './chat';
import complaints from './complaints';
import uploads from './uploads';
import admin from './admin';
import analytics from './analytics';
import meta from './meta';
import security from './security';

/** Barcha modullar ro'yxati. Yangi modul qo'shish — papka yaratib, shu ro'yxatga bitta qator qo'shish. */
export const MODULES: AppModule[] = [auth, users, categories, products, sellers, cart, orders, payments, delivery, reviews, favorites, notifications, chat, complaints, uploads, admin, analytics, meta, security];

/** Hech qachon o'chirib bo'lmaydigan asosiy modullar */
export const CORE_MODULES = ['auth', 'users', 'meta'];
