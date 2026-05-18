import * as React from 'react';
import css from './Button.module.css';

type Props = {
    label?: string;
    small?: boolean;
    className?: string;
    onClick: () => void;
}

export const Button: React.FC<Props> = ({ label = '', className = '', small = false, onClick }) => (
    <div className={`${css.button} ${small && css.smallButton} ${className}`.trimEnd()} onClick={onClick}>
        {label}
    </div>
);