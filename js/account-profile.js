/* Account/profile data is PostgreSQL-backed. Pages should use OptiSaveAPI.profile(), bankAccount(), and KYC APIs. */
function maskAccountNumber(value){const s=String(value||"");return s.length>=4?"••••••"+s.slice(-4):s;}
