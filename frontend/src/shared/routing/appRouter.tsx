import {createBrowserRouter} from 'react-router-dom';
import App from '../../App.tsx';

export const appRouter=createBrowserRouter([
  {path:'/',element:<App/>},
  {path:'/login',element:<App/>},
  {path:'*',element:<App/>}
]);
