const fs = require('fs');
let code = fs.readFileSync('src/server/accountRoutes.ts', 'utf8');

const newRoutes = `
accountRouter.post('/accounts/custom', async (req: Request, res: Response) => {
  try {
    const { tenantId = DEFAULT_TENANT_ID, parentAccountId, nameAr, nameEn, isPosting } = req.body;
    if (!parentAccountId || !nameAr) {
      res.status(400).json({ success: false, error: 'Parent ID and Arabic Name are required.' });
      return;
    }
    const newAccount = await accountEngine.createCustomAccount({ tenantId, parentAccountId, nameAr, nameEn, isPosting });
    res.status(201).json({ success: true, data: newAccount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

accountRouter.put('/accounts/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const updates = req.body;
    const updatedAccount = await accountEngine.updateAccount(id, updates);
    res.status(200).json({ success: true, data: updatedAccount });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
`;

if (!code.includes('/accounts/custom')) {
  code = code.replace(/accountRouter\.post\('\/accounts\/analytical'/g, newRoutes + '\naccountRouter.post(\'/accounts/analytical\'');
  fs.writeFileSync('src/server/accountRoutes.ts', code);
  console.log("Patched accountRoutes.ts");
} else {
  console.log("Already patched accountRoutes.ts");
}
