import { Link } from 'react-router-dom';
import LogoLight from '../../assets/logo-light.webp';
import LogoDark from '../../assets/logo-dark.webp';

export function NavLogo() {
    return (
        <Link to="/" draggable="false" className="flex items-center">
            <div className="relative flex items-center justify-center">
                {/* Light mode logo */}
                <img
                    src={LogoLight}
                    alt="Logo"
                    className="h-28 w-auto cursor-pointer active:scale-95 transition-transform relative z-10 block dark:hidden"
                    draggable="false"
                />
                {/* Dark mode logo */}
                <img
                    src={LogoDark}
                    alt="Logo"
                    className="h-28 w-auto cursor-pointer active:scale-95 transition-transform relative z-10 hidden dark:block"
                    draggable="false"
                />
            </div>
        </Link>
    );
}
