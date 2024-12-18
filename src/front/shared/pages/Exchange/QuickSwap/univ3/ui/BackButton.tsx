import cssModules from 'react-css-modules'
import styles from './BackButton.scss'

type BackButtonProps = {
  children: any
  onClick: () => void
}
const BackButton = (props: BackButtonProps) => {
  const {
    children,
    onClick
  } = props

  return (
    <div styleName="backButton">
      <a onClick={onClick}>
        <i className="fas fa-arrow-left"></i>
        <span>{children}</span>
      </a>
    </div>
  )
}

export default cssModules(BackButton, styles, { allowMultiple: true })
