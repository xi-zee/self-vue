import { resolveStyle } from '@/utils/style.js';


const AsyncComponentVnode = {
    name: 'AsyncComponent',
    setup () {
        return () => ({
            type: 'div',
            props: {
                style: resolveStyle('margin: 8px 16px; font-size: 16px; cursor: pointer; user-select: none;'),
            },
            children: 'this is a async component vnode',
        })
    }
}

export default AsyncComponentVnode;