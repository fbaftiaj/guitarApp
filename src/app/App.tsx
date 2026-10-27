import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createRoutes } from './routes';

const router = createBrowserRouter(createRoutes());

export function App() {
  return <RouterProvider router={router} />;
}
