import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import reducer, { initialState } from './components/Reducer';

/* Main Compnent */
import './Settings.scss';
import { StateProvider } from './components/Data';
import ViewContainer from './components/ViewContainer';

const container = document.getElementById( 'power-coupons-settings' );
const root = createRoot( container ); // Added compatibility for React 18.

const App = () => (
	<BrowserRouter>
		<StateProvider initialState={ initialState } reducer={ reducer }>
			<ViewContainer />
		</StateProvider>
	</BrowserRouter>
);

root.render( <App /> );
