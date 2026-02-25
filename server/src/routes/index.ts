import { Router } from 'express';
import clientsRouter      from './clients';
import projectsRouter     from './projects';
import timeEntriesRouter  from './timeEntries';
import tagsRouter         from './tags';
import invoicesRouter     from './invoices';
import expensesRouter     from './expenses';
import reportsRouter      from './reports';
import settingsRouter     from './settings';

const router = Router();

router.use('/clients',      clientsRouter);
router.use('/projects',     projectsRouter);
router.use('/time-entries', timeEntriesRouter);
router.use('/tags',         tagsRouter);
router.use('/invoices',     invoicesRouter);
router.use('/expenses',     expensesRouter);
router.use('/reports',      reportsRouter);
router.use('/settings',     settingsRouter);

export default router;
