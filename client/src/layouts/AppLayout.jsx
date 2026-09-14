import { Outlet } from 'react-router-dom';

/**
 * Shell for the signed-in app. The navy header, bottom tab bar and cards from
 * docs/screens/02-dashboard/ land in session 4 — this keeps the route tree
 * honest until then.
 */
export const AppLayout = () => (
  <div className="min-h-dvh bg-canvas">
    <div className="mx-auto w-full max-w-[26rem]">
      <Outlet />
    </div>
  </div>
);
