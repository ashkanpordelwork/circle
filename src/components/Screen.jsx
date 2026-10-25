import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Page } from './ui.jsx'

// A full page pushed over the current one, for work that needs room: choosing from a long list,
// or several fields at once. It keeps the state of the page underneath (an unsaved plan stays
// unsaved), has a back button, and the phone's own back gesture closes it too.
//
// Where a sheet goes and where a page goes:
//   sheet   one quick choice — a number on a wheel, a confirmation, a name. Never on another sheet.
//   Screen  anything with search, scrolling or more than one field.
// A sheet may open over a Screen; a Screen never opens from a sheet.

const Ctx = createContext({ close: () => {} })
export const useScreen = () => useContext(Ctx)

let seq = 0

export default function Screen({ title, subtitle, actions, onClose, children }) {
  const key = useRef('screen-' + ++seq)
  const alive = useRef(false)
  const [leaving, setLeaving] = useState(false)
  const done = useRef(onClose)
  done.current = onClose

  // An entry in the browser history, so «back» on the phone closes this page, not the app.
  // (Written to survive React running effects twice in development.)
  useEffect(() => {
    const k = key.current
    alive.current = true
    if (history.state?.screen !== k) history.pushState({ ...history.state, screen: k }, '')
    let handled = false
    const onPop = () => { if (!handled && history.state?.screen !== k) { handled = true; done.current() } }
    addEventListener('popstate', onPop)
    const scroller = document.scrollingElement
    const y = scroller.scrollTop
    document.documentElement.classList.add('has-screen')
    return () => {
      alive.current = false
      removeEventListener('popstate', onPop)
      document.documentElement.classList.remove('has-screen')
      scroller.scrollTop = y
      // Closed some other way (the item it edited was removed): drop our history entry quietly.
      setTimeout(() => { if (!alive.current && history.state?.screen === k) history.back() })
    }
  }, [])

  const close = useCallback(() => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => history.back(), 180)
  }, [leaving])

  return createPortal(<Ctx.Provider value={{ close }}>
    <div className={'screen' + (leaving ? ' leaving' : '')} role="dialog" aria-modal="true" aria-label={title}>
      <Page title={title} subtitle={subtitle} back={close} actions={actions} noTabbar>{children}</Page>
    </div>
  </Ctx.Provider>, document.body)
}
