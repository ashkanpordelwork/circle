// Material Symbols Rounded. Only the icons listed in scripts/fetch-fonts.mjs exist in the subset
// font — add a name there (and re-run it) before using a new one here.
// `mirror` flips directional icons for right-to-left, so "forward" and "back" point the way the
// reader is going.
export default function Icon({ name, filled, mirror, className = '', label, style }) {
  return <span className={`icon${filled ? ' filled' : ''}${mirror ? ' mirror' : ''} ${className}`} style={style}
    aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>{name}</span>
}

// In RTL a disclosure points left and "back" points right.
export const Disclosure = () => <Icon name="chevron_left" className="disclosure" />
