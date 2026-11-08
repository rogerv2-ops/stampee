import auth from './catalogs/auth';
import marketing from './catalogs/marketing';
import legal from './catalogs/legal';
import cards from './catalogs/cards';
import operations from './catalogs/operations';
import workspace from './catalogs/workspace';
import common from './catalogs/common';

export const catalogs = { auth, marketing, legal, cards, operations, workspace, common };
export const spanishCatalog: Readonly<Record<string, string>> = Object.assign({}, ...Object.values(catalogs));
