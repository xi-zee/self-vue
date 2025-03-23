/**
 * @file 虚拟DOM渲染器
 */

import { hasOwn, notEmpty } from '@/utils/index.js';

/**
 * @description 针对 text 和 comment 等类型做出的标识
 * @type {Symbol}
 * @readonly
 */
export const Text = Symbol.for('Text');
export const Comment = Symbol.for('Comment');
export const Fragment = Symbol.for('Fragment');
/**
 * @description 针对 Fragment 的类型
 * * 为什么要设计 Fragment 类型？
 * * 1. Fragment 是一个特殊的类型，它不会对应任何真实的 DOM 元素，只是一个占位符
 * * 2. 当我们在模板中使用多个根节点时，我们需要使用 Fragment 来包裹这些根节点
 *  <template>
 *   <div>1</div>
 *   <div>2</div>
 *  </template>
 * * 3. 上面的模板对应的虚拟节点应该是
 * {
 *      type: Fragment,
 *      children: [
 *          { type: 'div', children: '1' },
 *          { type: 'div', children: '2' }
 *      ]
 * }
 */


/**
 * @description 创建一个渲染器
 * @param {Object} option 配置项
 * @return {render } 渲染器
 */
const createRenderer = (option) => {
    const {
        createElement,
        createTextNode,
        createComment,
        insert,
        setElementText,
        patchProps,
    } = option;

    /**
     * @description 简单的虚拟DOM渲染器
     * @param {Object} vnode 虚拟DOM
     * @param {HTMLElement} container 容器
     */
    const render = (vnode, container) => {
        if (vnode) {
            // 新 vnode 存在，将其与旧 vnode 一起传递给 patch 函数，进行打补
            patch(container._vnode, vnode, container);
        } else {
            if (container._vnode) {
                // 新 vnode 不存在，旧的 vnode 存在，则是 unmount 操作
                /**
                 * ! container.innerHTML = ''
                 * 下面直接清空 container 的 innerHTML 是非常不严谨的 
                 * 1. container 内部可能存在某个或多个组件, 卸载操作应该是能够正常触发 beforeUnmount 和 unmounted 生命周期的
                 * 2. 某些元素上可能存在自定义指令, 我们需要在发生卸载操作能够正常触发 unbind 钩子函数
                 * 3. 某些元素上可能存在自定义事件, 我们需要在发生卸载操作能够正常触发 removeEventListener
                 * 
                 */
                unmount(container._vnode);
            }
        }
        // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
        container._vnode = vnode
    };

    /**
     * @description 卸载 组件
     * @param {HTMLElement} el 元素
     */
    const unmount = (vnode) => {
        // TODO: 触发 组件卸载的 beforeUnmount 等生命周期
        // TODO: 触发 unbind 钩子函数
        // 需要递归卸载子节点
        Array.isArray(vnode.children) && vnode.children.forEach(child => unmount(child));

        if (notEmpty(vnode.props)) {
            for (const key in vnode.props) {
                patchProps(vnode.el, key, vnode.props[key], null);
            }
        }

        // 卸载 Fragment 的子节点
        if (vnode.type === Fragment) {
            // 需要递归卸载子节点
            vnode.children.forEach(child => unmount(child));
            // Fragment 不对应任何真实的 DOM 元素，所以直接返回
            return
        }


        // 卸载组件
        if (typeof vnode.type === 'function') {
            // TODO
            // 触发组件的 beforeUnmount 生命周期
            // 触发组件的 unmounted 生命周期
            // 触发组件的 unbind 钩子函数
            // 触发组件的 removeEventListener
            // 触发组件的 removeAttribute
            // 触发组件的 removeChild
            vnode.subTree && unmount(vnode.subTree);
        }

        const parent = vnode.el?.parentNode;
        parent && parent.removeChild(vnode.el);
    };

    /**
     * @description 对比新旧虚拟DOM，进行打补
     * @param {Object} ov 旧虚拟DOM
     * @param {Object} nv 新虚拟DOM
     * @param {HTMLElement} container 容器
     */
    const patch = (ov, nv, container, anchor = null) => {
        if (ov && nv && ov.type !== nv.type) {
            // 如果新旧 vnode 的类型不同，则直接将旧 vnode 卸载
            unmount(ov);
            ov = null;
        }
        const { type } = nv;
        if (typeof type === 'string') {
            // 表述的是一个 DOM 元素
            if (!ov) {
                mountElement(nv, container, anchor);
            } else {
                patchElement(ov, nv);
            }
        } else if (type === Text) {
            if (!ov) {
                // 旧节点不存在, 则直接创建文本节点到并挂载到容器中
                const el = nv.el = createTextNode(nv.children);
                insert(el, container);
            } else {
                // 如果旧 vnode 存在，只需要使用新文本节点的文本内容更新旧文本节点即
                const el = nv.el = ov.el;
                if (el.textContent !== nv.children) {
                    el.textContent = nv.children;
                }
            }
        } else if (type === Comment) {
            if (!ov) {
                // 旧节点不存在, 则直接创建注释节点到并挂载到容器中
                const el = nv.el = createComment(nv.children);
                insert(el, container);
            } else {
                // 如果旧 vnode 存在，只需要使用新注释节点的文本内容更新旧注释节点即
                const el = nv.el = ov.el;
                if (el.textContent !== nv.children) {
                    el.textContent = nv.children;
                }
            }
        } else if (type === Fragment) {
            if (!ov) {
                // 旧节点不存在, 则直接挂载 Fragment 的子节点到容器中
                nv.children.forEach(child => patch(null, child, container));
            } else {
                // 如果旧 vnode 存在，只需要使用新 Fragment 的子节点更新旧 Fragment 的子节点即
                patchChildren(ov, nv, container);
            }
        } else if (typeof type === 'function') {
            // 表述的是一个组件
            if (!ov) {
                mountComponent(nv, container);
            } else {
                patchComponent(ov, nv, container);
            }
        }
    };

    /**
     * @description 挂载 DOM 元素
     * @param {Object} vnode 虚拟DOM
     * @param {HTMLElement} container 容器
     */
    const mountElement = (vnode, container, anchor) => {
        const el = vnode.el = createElement(vnode.type);

        if (notEmpty(vnode.children)) {
            if (Array.isArray(vnode.children)) {
                vnode.children.forEach(child => {
                    patch(null, child, el);
                });
            } else {
                setElementText(el, vnode.children);
            }
        }

        if (notEmpty(vnode.props)) {
            for (const key in vnode.props) {
                patchProps(el, key, null, vnode.props[key]);
            }
        }
        
        insert(el, container, anchor);
    };

    /**
     * @description 更新 DOM 元素
     * @param {Object} ov 旧虚拟DOM
     * @param {Object} nv 新虚拟DOM
     */
    const patchElement = (ov, nv) => {
        const el = nv.el = ov.el;
        const oldProps = ov.props;
        const newProps = nv.props;
        // 第一步：更新 props
        if (notEmpty(newProps)) {
            for (const key in newProps) {
                if (newProps[key] !== oldProps[key]) {
                    patchProps(el, key, oldProps[key], newProps[key]);
                }
            }
        }
        if (notEmpty(oldProps)) {
            for (const key in oldProps) {
                if (!hasOwn(newProps, key)) {
                    patchProps(el, key, oldProps[key], null);
                }
            }
        }
        // 第二步：更新 children
        patchChildren(ov, nv, el)
    };

    /**
     * @description 更新子节点
     * @param {Object} ov 旧虚拟DOM
     * @param {Object} nv 新虚拟DOM
     * @param {HTMLElement} container 容器
     */
    const patchChildren = (ov, nv, container) => {
        //* 新子节点是一组子节点
        if (Array.isArray(nv.children)) {
            //* 判断旧子节点是否也是一组子节点
            if (Array.isArray(ov.children)) {
                patchKeyedChildren(ov, nv, container);
            } else {
                //* 旧子节点不是一组子节点, 要么没有子节点, 要么是文本子节点
                //! 但无论哪种情况，我们都只需要将容器清空，然后将新的一组子节点逐个挂载到容器中
                setElementText(container, '')
                nv.children.forEach(child => patch(null, child, container))
            }
        }
        //* 判断新子节点的类型是否是文本节点 TextNode
        else if (notEmpty(nv.children)) {
            //* 旧子节点的类型有三种可能：没有子节点、文本子节点以及一组子节点
            if (Array.isArray(ov.children)) {
                //! 只有当旧子节点为一组子节点时，才需要逐个卸载，其他情况下什么都不需要做
                ov.children.forEach(child => unmount(child));
            }
            setElementText(container, nv.children);
        }
        //* 新节点不存在
        else {
            if (Array.isArray(ov.children)) {
                // 旧子节点的是一组子节点
                ov.children.forEach(child => unmount(child));
            } else if (typeof ov.children === 'string') {
                // 旧子节点是文本子节点
                setElementText(container, '');
            }
            // 旧子节点不存在 无需处理
        }
    };

    /**
     * @description 对比新旧虚拟DOM的一组子节点 diff 算法
     * @param {Object} ov 旧虚拟DOM
     * @param {Object} nv 新虚拟DOM
     * @param {HTMLElement} container 容器
     */
    const patchKeyedChildren = (ov, nv, container) => {
        //! 暂时使用傻瓜方式, 逐个卸载旧子节点, 然后逐个挂载新子节点 => 等 diff 算法实现后再替换
        // ov.children.forEach(child => unmount(child));
        // nv.children.forEach(child => patch(null, child, container));
        //! 优化前
        // const oldChildren = ov.children;
        // const newChildren = nv.children;
        // const oldLen = oldChildren.length;
        // const newLen = newChildren.length;
        // const commonLen = Math.min(oldChildren.length, newChildren.length);
        // // diff 对比公共长度的子节点
        // for (let i = 0; i < commonLen; i++) {
        //     patch(oldChildren[i], newChildren[i], container);
        // }
        // //* 如果新节点的长度小于旧节点的长度, 则卸载多余的旧节点
        // if (oldLen > newLen) {
        //     for (let i = commonLen; i < oldLen; i++) {
        //         unmount(oldChildren[i]);
        //     }
        // }
        // //* 如果新节点的长度大于旧节点的长度, 则挂载新节点
        // else if (oldLen < newLen) {
        //     for (let i = commonLen; i < newLen; i++) {
        //         patch(null, newChildren[i], container);
        //     }
        // }

        //! 优化后的简单 diff 算法
        // const oldChildren = ov.children;
        // const newChildren = nv.children;

        // // 用来存储寻找过程中遇到的最大索引值
        // let lastIndex = 0;
        // // 遍历新的子节点
        // for (let i = 0; i < newChildren.length; i++) {
        //     const newVnode = newChildren[i];

        //     // 在第一层循环中定义变量 find，代表是否在旧的一组子节点中找到可复用的节点
        //     let find = false;
        //     // 遍历旧的子节点 => 移动 DOM
        //     for (let j = 0; j < oldChildren.length; j++) {
        //         const oldVnode = oldChildren[j];
        //         //! key 存在的前提 如果新旧子节点的 key 相同，则进行打补
        //         if (newVnode.key === oldVnode.key) {
        //             find = true;
        //             patch(oldVnode, newVnode, container);
        //             if (j < lastIndex) {
        //                 /**
        //                  *  从 [1, 2, 3, 4] 变成  [3, 1, 2, 4]  显而易见的发现 1 的位置变到 3 的后面, 
        //                  *  3 寻找的 oldIndex 是 2, 1 的 oldIndex 是 0
        //                  */
        //                 // 代码运行到这里，说明 newVNode 对应的真实 DOM 需要移动, 先获取 newVNode 的前一个 vnode，即 prevVNode
        //                 const prevVNode = newChildren[i - 1];
        //                 if (prevVNode) {
        //                     // 使用 nextSibling 而是不是 nextElementSibling 是因为：nextSibling 返回下一个节点（元素节点、文本节点或注释节点）。元素之间的空白也是文本节点。 *** 主要是这个空白
        //                     const anchor = prevVNode.el.nextSibling
        //                     insert(newVnode.el, container, anchor);
        //                 }
        //                 // 如果 prevVNode 不存在，则说明当前 newVNode 是第一个节点，它不需要移动
        //             } else {
        //                 /**
        //                  * 从 [1, 2, 3, 4] 变成  [1, 2, 4, 3]  显而易见的发现 3 的位置变到 4 的后面,
        //                  */
        //                 lastIndex = j;
        //             }
        //             break;
        //         }
        //     }

        //     // 遍历子节点之后, 如果还未找到可复用的, 则代表 newVnode 是新增节点
        //     if (!find) {
        //         // 为了将节点挂载到正确位置, 我们需要先获取锚点元素, 获取当前 newVNode 的前一个 vnode 节点
        //         const prevVNode = newChildren[i - 1];
        //         let anchor = null;
        //         if (prevVNode) {
        //             anchor = prevVNode.el.nextSibling;
        //         } else {
        //             // 如果 prevVnode 不存在, 则代表新增节点是第一个子节点
        //             // 这时我们使用容器元素的 firstChild 作为锚点
        //             anchor = container.firstChild;
        //         }

        //         // 挂载 newVNode
        //         patch(null, newVnode, container, anchor)
        //     }
        // }

        // // 移除已经不需要的节点
        // for (let i = 0; i < oldChildren.length; i++) {
        //     const oldVnode = oldChildren[i];
        //     const has = newChildren.find(newVnode => newVnode.key === oldVnode.key);
        //     !has && unmount(oldVnode);
        // }

        //! 双端 diff 算法
        const oldChildren = ov.children;
        const newChildren = nv.children;
        // 四个索引值
        let oldStartIdx = 0;
        let oldEndIdx = oldChildren.length - 1;
        let newStartIdx = 0;
        let newEndIdx = newChildren.length - 1;
        // 四个索引值指向的 vnode 节点
        let oldStartVnode = oldChildren[oldStartIdx];
        let oldEndVnode = oldChildren[oldEndIdx];
        let newStartVnode = newChildren[newStartIdx];
        let newEndVnode = newChildren[newEndIdx];

        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            // 旧节点的 oldStartIdx 处的节点可能已经被处理过了
            if (!oldStartVnode) {
                oldStartVnode = oldChildren[++oldStartIdx];
            }
            else if (!oldEndVnode) {
                oldEndVnode = oldChildren[--oldEndIdx];
            }
            else if (oldStartVnode.key === newStartVnode.key) {
                patch(oldStartVnode, newStartVnode, container);
                oldStartVnode = oldChildren[++oldStartIdx];
                newStartVnode = newChildren[++newStartIdx];
            } 
            else if (oldEndVnode.key === newEndVnode.key) {
                patch(oldEndVnode, newEndVnode, container);
                oldEndVnode = oldChildren[--oldEndIdx];
                newEndVnode = newChildren[--newEndIdx];
            } 
            else if (oldStartVnode.key === newEndVnode.key) {
                patch(oldStartVnode, newEndVnode, container);
                insert(oldStartVnode.el, container, oldEndVnode.el.nextSibling);
                oldStartVnode = oldChildren[++oldStartIdx]
                newEndVnode = newChildren[--newEndIdx];
            } 
            else if (oldEndVnode.key === newStartVnode.key) {
                patch(oldEndVnode, newStartVnode, container);
                insert(oldEndVnode.el, container, oldStartVnode.el);
                newStartVnode = newChildren[++newStartIdx];
                oldEndVnode = oldChildren[--oldEndIdx];
            }
            else {
                const idxInOld = oldChildren.findIndex(node => node.key === newStartVnode.key);
                if (idxInOld > 0) {
                    const vnodeToMove = oldChildren[idxInOld];
                    patch(vnodeToMove, newStartVnode, container);
                    insert(vnodeToMove.el, container, oldStartVnode.el);
                    oldChildren[idxInOld] = undefined;
                } else {
                    patch(null, newStartVnode, container, oldStartVnode.el);
                }
                newStartVnode = newChildren[++newStartIdx];
            }
        }

        // 循环结束后检查索引值的情况
        if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
            // 如果条件成立, 说明旧节点已经遍历完, 新节点还有剩余
            // 这时我们需要将剩余的新节点挂载到容器中
            for (let i = newStartIdx; i <= newEndIdx; i++) {
                patch(null, newChildren[i], container, oldStartVnode.el);
            }
        } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
            // 如果条件成立, 说明新节点已经遍历完, 旧节点还有剩余
            // 这时我们需要将剩余的旧节点卸载
            for (let i = oldStartIdx; i <= oldEndIdx; i++) {
                unmount(oldChildren[i]);
            }
        }
    };

    /**
     * @description 挂载组件
     * @param {Object} vnode 虚拟DOM
     * @param {HTMLElement} container 容器
     */
    const mountComponent = (vnode, container) => {
        const subTree = vnode.type();
        vnode.subTree = subTree;
        patch(null, subTree, container);
    };

    /**
     * @description 更新组件
     * @param {Object} ov 旧虚拟DOM
     * @param {Object} nv 新虚拟DOM
     */
    const patchComponent = (ov, nv, container) => {
        const subTree = nv.type();
        nv.subTree = subTree;
        patch(ov.subTree, subTree, container);
    };

    return {
        render,
    }
}


export default createRenderer;
