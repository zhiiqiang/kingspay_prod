import { Helmet } from 'react-helmet-async';
import { Main } from './components/main';

export function Layout4() {
  return (
    <>
      <Helmet>
        <title>Kingspay Administrator</title>
      </Helmet>

      <Main />
    </>
  );
}
