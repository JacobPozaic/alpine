import { startObservingMutations, onAttributesAdded, onElAdded, onElRemoved, cleanupAttributes } from "./mutation"
import { deferHandlingDirectives, directives } from "./directives"
import { dispatch } from './utils/dispatch'
import { nextTick } from "./nextTick"
import { walk } from "./utils/walk"
import { warn } from './utils/warn'

export function start() {
    if (! document.body) warn('Unable to initialize. Trying to load Alpine before `<body>` is available. Did you forget to add `defer` in Alpine\'s `<script>` tag?')

    dispatch(document, 'alpine:init')
    dispatch(document, 'alpine:initializing')

    startObservingMutations()

    onElAdded(el => initTree(el, walk))
    onElRemoved(el => nextTick(() => destroyTree(el)))

    onAttributesAdded((el, attrs) => {
        directives(el, attrs).forEach(handle => handle())
    })

    let outNestedComponents = el => ! closestRoot(el.parentNode || closestRoot(el))

    Array.from(document.querySelectorAll(allSelectors()))
        .filter(outNestedComponents)
        .forEach(el => {
            initTree(el)
        })

    dispatch(document, 'alpine:initialized')
}

let rootSelectorCallbacks = []
let initSelectorCallbacks = []

export function rootSelectors() {
    return rootSelectorCallbacks.map(fn => fn())
}

export function allSelectors() {
    return rootSelectorCallbacks.concat(initSelectorCallbacks).map(fn => fn())
}

export function addRootSelector(selectorCallback) { rootSelectorCallbacks.push(selectorCallback) }
export function addInitSelector(selectorCallback) { initSelectorCallbacks.push(selectorCallback) }

export function closestRoot(el) {
    if (rootSelectors().some(selector => el.matches(selector))) return el

    if (! el.parentElement) return

    return closestRoot(el.parentElement)
}

export function isRoot(el) {
    return rootSelectors().some(selector => el.matches(selector))
}

export function initTree(el, walker = walk) {
    try {
        deferHandlingDirectives(() => {
            walker(el, (el, skip) => {
                directives(el, el.attributes).forEach(handle => handle())

                el._x_ignore && skip()
            })
        })
    } catch( error ) {
        if( error.el && error.expression ) {
            setTimeout(() => {
                throw error
            }, 0 )
        } else {
            // somehow we failed to assign element and expression, let's at least assign element
            Object.assign( error, { el, expression: "[UNKNOWN]" } )

            console.warn(`Alpine Error: ${error.message}\n\n`, el)
            setTimeout(() => {
                throw error
            }, 0 )
        }
    }
}

function destroyTree(root) {
    walk(root, el => cleanupAttributes(el))
}
