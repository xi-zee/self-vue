/**
 * @file 虚拟DOM渲染器
 */

import { effect, reactive, ref, shallowRef, shallowReactive, shallowReadonly } from '@vue/reactivity';

import { hasOwn, notEmpty, getSequence } from '@/utils/index';
import { resolveProps, hasPropsChanged } from '@/utils/props';

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

    const queue = new Set();
    let isFlushing = false;
    const p = Promise.resolve();
    const queueJob = (job) => {
        queue.add(job);
        console.log(queue);
        if (!isFlushing) {
            // 标识设为 true, 避免重复刷新
            isFlushing = true;
            // 微任务队列中刷新缓冲队列
            p.then(() => {
                try {
                    // 执行任务
                    queue.forEach((job) => job?.());
                } finally {
                    isFlushing = false;
                    queue.clear();
                }
            })
        }
    }

    // 全局变量，存储当前正在被初始化的组件实例
    let currentInstance = null

    const setCurrentInstance = (instance) => {
        currentInstance = instance;
    }

    const onMounted = (callback) => {
        if (currentInstance) {
            currentInstance.mounted.push(callback);
        } else {
            console.error('onMounted 函数只能在 setup 中调用');
        }
    }

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
        // TODO: 触发 unbind 钩子函数
        // 需要递归卸载子节点
        Array.isArray(vnode.children) && vnode.children.forEach(child => unmount(child));

        if (typeof vnode.type === 'object') {
            unmount(vnode.component.subTree);
            return;
        }

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
        } else if (typeof type === 'object') {
            // 表述的是一个组件
            if (!ov) {
                mountComponent(nv, container, anchor);
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
        // !简单 diff 算法
        // simpleDiff(ov, nv, container);

        //! 双端 diff 算法 vue2
        // doubleEndedDiff(ov, nv, container);

        // ! 快速 diff 算法
        fastDiff(ov, nv, container);
    };

    /**
     * @description 挂载组件
     * @param {Object} vnode 虚拟DOM
     * @param {HTMLElement} container 容器
     * @param {HTMLElement} anchor 锚点
     */
    const mountComponent = (vnode, container, anchor) => {
        const componentOptions = vnode.type;
        const { 
            data,
            props: propsOption,
            setup,
            beforeCreate, created,
            beforeMount, mounted, 
            beforeUpdate, updated
        } = componentOptions;

        let { render } = componentOptions;

        // * 下面的生命周期钩子，可能存在多个，如 Mixins， 所以其实是一个被序列化的数组，foreach 执行
        beforeCreate && beforeCreate();

        // 调用 resolveProps 函数解析出最终的 props 数据与 attrs 数据
        const [props, attrs] = resolveProps(propsOption, vnode.props);

        const emit = (event, ...payload) => {
            const eventName = `on${event[0].toUpperCase()}${event.slice(1)}`;
            const handler = instance.props[eventName];
            if (handler) {
                handler(...payload);
            } else {
                console.warn(`事件 ${eventName} 未定义`);
            }
        }

        // 直接使用编译好的 vnode.children 对象作为 slots 对象即可
        const slots = vnode.children || {}

        const state = data ? reactive(data()) : null;
        const instance = {
            attrs,
            // 组件自身的状态
            state,
            // 将解析出的 props 数据包装为 shallowReactive 并定义到组件实例上
            props: shallowReactive(props),
            // 一个布尔值，用来表示组件是否被挂载，初始值 false
            isMounted: false,
            // 组件所渲染的内容， 子树
            subTree: null,
            slots,
            mounted: [],
        }

        // setupContext
        const setupContext = {
            attrs,
            emit,
            slots,
        };

        // 在调用 setup 函数之前，设置当前组件实例
        setup && setCurrentInstance(instance);

        // 调用 setup 函数，传入 props 和 setupContext
        const setupResult = setup?.(shallowReadonly(instance.props), setupContext) ?? null;
        // setupState 用来存储由 setup 返回的数据
        let setupState = null;
        // 如果 setupResult 是一个函数，则表示组件的渲染函数
        if (typeof setupResult === 'function') {
            if (render) {
                console.warn('setup 函数返回了渲染函数，但组件中已经定义了 render 函数，render 函数将被覆盖');
            }
            render = setupResult;
        } else {
            // 如果 setupResult 是一个对象，则表示组件的状态
            setupState = setupResult;
        }

        // 在 setup 函数执行完毕之后，重置当前组件实例
        setCurrentInstance(null)

        vnode.component = instance;

        // 还未处理 computed 和 methods, 都需要绑定到 实例上
        const renderContext = new Proxy(instance, {
            get(target, key, raw) {
                const { state, props, slots } = target;
                // 1. 先从 state 中获取值
                if (state && key in state) {
                    return state[key];
                }
                // 2. 再从 props 中获取值
                else if (key in props) {
                    return props[key];
                }
                // 3. 渲染上下文需要增加对 setupState 的支持
                else if (setupState && key in setupState) {
                    return setupState[key];
                }
                else if (k === '$slots') {
                    return slots
                }
                console.error('不存在');
                return undefined;
            },
            set(target, key, value, raw) {
                const { state, props } = target;
                // 1. 先从 state 中获取值
                if (state && key in state) {
                    state[key] = value;
                } else if (key in props) {
                    // 2. 再从 props 中获取值
                    console.warn(`Attempting to mutate prop "${key}". Props are readonly.`)
                    // 生产环境还是赋值给 props[key]， 但是会有警告
                    props[key] = value;
                }
                // 渲染上下文需要增加对 setupState 的支持
                else if (setupState && key in setupState) {
                    setupState[key] = value;
                }
                // 设置 slots 不允许成立
                else if (key === '$slots') {
                    return false;
                }
                else {
                    console.error('不存在');
                    return false;
                }
                return true;
            }
        });

        created && created.call(renderContext);

        if (!render) {
            render = () => {
                return {
                    type: Comment,
                    children: ''
                }
            }
        }

        effect(() => {
            const subTree = render.call(renderContext, renderContext);
            // 初次挂载
            if (!instance.isMounted) {
                beforeMount && beforeMount.call(renderContext);
                patch(null, subTree, container, anchor);
                instance.isMounted = true;
                // 其他生命周期函数同理
                instance.mounted && instance.mounted.forEach(hook =>
                    hook.call(renderContext))
                mounted && mounted.call(renderContext)
            }
            // 当 isMounted 为 true 时，说明组件已经被挂载，只需要完成自更新即
            else {
                beforeUpdate && beforeUpdate.call(renderContext);
                patch(instance.subTree, subTree, container, anchor);
                updated && updated.call(renderContext);
            }
            instance.subTree = subTree
        }, {
            // scheduler: (ef) => queueJob(ef),
        });
    };

    /**
     * @description 更新组件
     * @param {Object} ov 旧虚拟DOM
     * @param {Object} nv 新虚拟DOM
     * @param {HTMLElement} container 容器
     */
    const patchComponent = (ov, nv, container, anchor) => {
        // 获取组件实例，即 n1.component
        const instance = (nv.component = ov.component);
        // 本身就是 shallowReactive 的 props, 直接赋值即可就可以触发响应式更新
        const { props } = instance;
        // 判断是不是真的需要更新
        const hasChanged = hasPropsChanged(ov.props, nv.props);

        if (hasChanged) {
            // 调用 resolveProps 函数重新获取 props 数据
            const [nextProps] = resolveProps(nv.type.props, nv.props);
            // 重新赋值 props 数据
            for (const key in nextProps) {
                // 待确认 结构后的 props 是否还具备响应式特性
                props[key] = nextProps[key];
            }
            // 移除不需要的 props 数据
            for (const key in props) {
                if (!key in nextProps) {
                    Reflect.deleteProperty(props, key);
                }
            }
            // attrs 与 props 同理
            const { attrs } = instance;
            for (const key in nv.attrs) {
                attrs[key] = nv.attrs[key];
            }
            for (const key in attrs) {
                if (!key in nv.attrs) {
                    Reflect.deleteProperty(attrs, key);
                }
            }
        }
    };


    /**
     * @description 简单 diff 算法
     * @param {@} ov 
     * @param {*} nv 
     * @param {*} container 
     */
    const simpleDiff = (ov, nv, container) => {
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
        const oldChildren = ov.children;
        const newChildren = nv.children;

        // 用来存储寻找过程中遇到的最大索引值
        let lastIndex = 0;
        // 遍历新的子节点
        for (let i = 0; i < newChildren.length; i++) {
            const newVnode = newChildren[i];

            // 在第一层循环中定义变量 find，代表是否在旧的一组子节点中找到可复用的节点
            let find = false;
            // 遍历旧的子节点 => 移动 DOM
            for (let j = 0; j < oldChildren.length; j++) {
                const oldVnode = oldChildren[j];
                //! key 存在的前提 如果新旧子节点的 key 相同，则进行打补
                if (newVnode.key === oldVnode.key) {
                    find = true;
                    patch(oldVnode, newVnode, container);
                    if (j < lastIndex) {
                        /**
                         *  从 [1, 2, 3, 4] 变成  [3, 1, 2, 4]  显而易见的发现 1 的位置变到 3 的后面, 
                         *  3 寻找的 oldIndex 是 2, 1 的 oldIndex 是 0
                         */
                        // 代码运行到这里，说明 newVNode 对应的真实 DOM 需要移动, 先获取 newVNode 的前一个 vnode，即 prevVNode
                        const prevVNode = newChildren[i - 1];
                        if (prevVNode) {
                            // 使用 nextSibling 而是不是 nextElementSibling 是因为：nextSibling 返回下一个节点（元素节点、文本节点或注释节点）。元素之间的空白也是文本节点。 *** 主要是这个空白
                            const anchor = prevVNode.el.nextSibling
                            insert(newVnode.el, container, anchor);
                        }
                        // 如果 prevVNode 不存在，则说明当前 newVNode 是第一个节点，它不需要移动
                    } else {
                        /**
                         * 从 [1, 2, 3, 4] 变成  [1, 2, 4, 3]  显而易见的发现 3 的位置变到 4 的后面,
                         */
                        lastIndex = j;
                    }
                    break;
                }
            }

            // 遍历子节点之后, 如果还未找到可复用的, 则代表 newVnode 是新增节点
            if (!find) {
                // 为了将节点挂载到正确位置, 我们需要先获取锚点元素, 获取当前 newVNode 的前一个 vnode 节点
                const prevVNode = newChildren[i - 1];
                let anchor = null;
                if (prevVNode) {
                    anchor = prevVNode.el.nextSibling;
                } else {
                    // 如果 prevVnode 不存在, 则代表新增节点是第一个子节点
                    // 这时我们使用容器元素的 firstChild 作为锚点
                    anchor = container.firstChild;
                }

                // 挂载 newVNode
                patch(null, newVnode, container, anchor)
            }
        }

        // 移除已经不需要的节点
        for (let i = 0; i < oldChildren.length; i++) {
            const oldVnode = oldChildren[i];
            const has = newChildren.find(newVnode => newVnode.key === oldVnode.key);
            !has && unmount(oldVnode);
        }
    };

    /**
     * @description 双端 diff 算法
     * @param {*} ov 
     * @param {*} nv 
     * @param {*} container 
     */
    const doubleEndedDiff = (ov, nv, container) => {
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
     * @description 快速 diff 算法
     */
    const fastDiff = (ov, nv, container) => {
        const newChildren = nv.children;
        const oldChildren = ov.children;
        // 处理前置相同的节点，开始的索引都为 0
        let commonStartIdx = 0;
        let oldVnode = oldChildren[commonStartIdx];
        let newVnode = newChildren[commonStartIdx];

        while (oldVnode && newVnode && oldVnode.key === newVnode.key) {
            patch(oldVnode, newVnode, container);
            commonStartIdx++;
            oldVnode = oldChildren[commonStartIdx];
            newVnode = newChildren[commonStartIdx];
        }

        // 处理后置相同的节点，但是 newChildren 和 oldChildren 的长度可能不同， 所以需要维护两个索引
        let oldEndIdx = oldChildren.length - 1;
        let newEndIdx = newChildren.length - 1;
        oldVnode = oldChildren[oldEndIdx];
        newVnode = newChildren[newEndIdx];

        // Math.min(oldEndIdx, newEndIdx) > commonStartIdx 后置相同节点必须大于已经共同处理过的前置相同节点, 否则就是重复处理
        while(oldVnode && newVnode && Math.min(oldEndIdx, newEndIdx) > commonStartIdx && oldVnode.key === newVnode.key) {
            patch(oldVnode, newVnode, container);
            oldVnode = oldChildren[--oldEndIdx];
            newVnode = newChildren[--newEndIdx];
        }

        // 前置相同和后置相同的节点处理完毕后，我们需要处理剩余的节点
        // 1. 如果 commonStartIdx > oldEndIdx，说明新节点的数量大于旧节点的数量，需要挂载新节点
        if (commonStartIdx > oldEndIdx && commonStartIdx <= newEndIdx) {
            // 锚点的索引
            const anchorIdx = newEndIdx + 1;
            const anchor = anchorIdx < newChildren.length + 1 ? newChildren[anchorIdx].el : null;
            while(commonStartIdx <= newEndIdx) {
                patch(null, newChildren[commonStartIdx], container, anchor);
                commonStartIdx++;
            }
        }
        // 2. 如果 commonStartIdx > newEndIdx，说明旧节点的数量大于新节点的数量，需要卸载旧节点
        else if (commonStartIdx <= oldEndIdx && commonStartIdx > newEndIdx) {
            while(commonStartIdx <= oldEndIdx) {
                unmount(oldChildren[commonStartIdx++]);
            }
        }
        // 3. 上面都不满足，则是较为复杂的无法预处理或者较少能预处理的节点
        else {
            const needPatchCount = newEndIdx - commonStartIdx + 1;
            if (needPatchCount <=0)return;
            
            const source = new Array(needPatchCount).fill(-1);
            const oldStartIdx = commonStartIdx;
            const newStartIdx = commonStartIdx;
            let moved = false;
            let pos = 0;

            // 新增 patched 变量，代表更新过的节点数量
            let patched = 0;

            // 遍历旧的一组子节点
            // for (let i = oldStartIdx; i <= oldEndIdx; i++) {
            //     const oldVNode = oldChildren[i];
            //     // 遍历新的一组子节点
            //     for (let j = newStartIdx; j <= newEndIdx; j++) {
            //         const newVNode = newChildren[j];
            //         if (oldVNode.key === newVNode.key) {
            //             patch(oldVNode, newVNode, container)
            //             source[j - newStartIdx] = i;
            //             break;
            //         }
            //     }
            // }
            // ! 上面两层嵌套循环, 时间复杂度随着 oldChildren、newChildren 骤增 O(n^2)
            // *所以空间换时间, 建立一个 Map 表, 用来存储 newChildren 的 key 和 index 的映射关系
            const keysIndex = {};
            for (let i = newStartIdx; i <= newEndIdx; i++) {
                Reflect.set(keysIndex, newChildren[i].key, i);
            }

            for (let j = oldStartIdx; j <= oldEndIdx; j++) {
                oldVnode = oldChildren[j];
                // 旧子节点很多、新子节点相对较少, 其实 keysIndex.has(oldVnode.key) 会不成立，但是我们还是不让走表查询，直接卸载更节省性能👍
                if (patched > needPatchCount) {
                    unmount(oldVnode)
                } else {
                    // 如果旧子节点在新子节点表中存在，则进行打补
                    const keyIdx = keysIndex[oldVnode.key];
                    if (typeof keyIdx !== 'undefined') {
                        newVnode = newChildren[keyIdx];
                        source[keyIdx - oldStartIdx] = j;
                        // 每更新一个节点，都将 patched 变量 +1
                        patched++
                        patch(oldVnode, newVnode, container);

                        // 下面用的简单 diff, 不理解可看上面简单 diff 算法
                        if (keyIdx < pos) {
                            moved = true;
                        } else {
                            pos = keyIdx;
                        }
                    }
                    // 如果旧子节点在新子节点表中不存在，则卸载旧子节点
                    else {
                        unmount(oldVnode);
                    }
                }
            }

            // 如果 moved 为真，则需要进行 DOM 移动操作
            if (moved) {
                // 最长递增子序列则是代表不需要移动的列表
                const seq = getSequence(source);
                // s 指向最长递增子序列的最后一个元素
                let s = seq.length - 1;
                // i 指向新的一组子节点的最后一个元素
                let x = needPatchCount - 1;
                for (x; x >= 0; x--) {
                    // 说明索引为 x 的节点是全新的节点，应该将其挂载
                    if (source[x] === -1) {
                        const pos = x + newStartIdx;
                        const newVNode = newChildren[pos];
                        // 该节点的下一个节点的位置索引
                        const nextPos = pos + 1;
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
                        patch(null, newVNode, container, anchor);
                    }
                    // 如果节点的索引 x 不等于 seq[s] 的值，说明该节点需要移动
                    else if (x !== seq[s]) {
                        const pos = x + newStartIdx;
                        const newVNode = newChildren[pos];
                        // 该节点的下一个节点的位置索引
                        const nextPos = pos + 1;
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
                        insert(newVNode.el, container, anchor);
                    }
                    else {
                        // 当 i === seq[s] 时，说明该位置的节点不需要移动, 只需要让 s 指向下一个位置
                        s--;
                    }
                }
            }
        }

    };

    const defineAsyncComponent = (options) => {
        if (!options) throw Error('defineAsyncComponent need a param')
        let InnerComponent = null;

        const finalOptions = {};

        switch (typeof options) {
            case 'function':
                finalOptions.loader = options;
                break
            case 'object':
                Object.assign(finalOptions, options);
                break;
            default:
                break
        }

        // 记录重试次数
        let retries = 0;
        const doLoad = () => {
            return finalOptions.loader().catch(err => {
                // 如果用户指定了 onError 回调，则将控制权交给用户
                if (finalOptions.onError) {
                    // 返回一个新的 Promise 实例
                    return new Promise((resolve, reject) => {
                        // 重试
                        const retry = () => {
                            resolve(doLoad());
                            retries++;
                        };
                        const fail = () => {
                            reject(err);
                        }
                        finalOptions.onError(retry, fail, retries);
                    });
                } else {
                    // 如果没有指定 onError 回调，则直接抛出错误
                    throw err;
                }
            })
        }

        return {
            name: 'AsyncComponentWrapper',
            setup() {
                const { loader } = finalOptions;
                // 异步组件是否加载成功
                const loaded = ref(false);
                // 异步组件是否加载超时
                const timeout = ref(false);
                let timer = null;
                // 异步组件加载失败时的错误信息
                const error = shallowRef(null);
                // 一个标志，代表是否正在加载，默认为 false
                const loading = ref(false);
                let loadingTimer = null

                const placeholder = {
                    type: Comment,
                    children: 'Async Component Loading...'
                }

                if (finalOptions.delay) {
                    // 设置延迟加载的定时器
                    loadingTimer = setTimeout(() => {
                        loading.value = true;
                    }, finalOptions.delay);
                } else {
                    loading.value = true;
                }

                // loader 是一个函数，表示异步加载组件的函数
                // 通过 loader 函数获取组件
                doLoad().then((component) => {
                    InnerComponent = component.default || component;
                    loaded.value = true;
                }).catch((err) => {
                    console.error('Async component loading failed:', err);
                    error.value = err;
                }).finally(() => {
                    // 清除定时器
                    timer && clearTimeout(timer);
                    loadingTimer && clearTimeout(loadingTimer);
                })

                if (finalOptions.timeout) {
                    // 设置定时器，超时后将 timeout 设置为 true
                    timer = setTimeout(() => {
                        timeout.value = true;
                        // 超时后创建一个错误对象，并复制给 error.value
                        const err = new Error(`Async component timed out after${finalOptions.timeout}ms.`)
                        error.value = err;
                    }, finalOptions.timeout);
                }

                return () => {
                    if (loaded.value) {
                        // 如果异步组件加载成功，则渲染异步组件
                        return {
                            type: InnerComponent,
                        };
                    } else if (error.value && finalOptions.errorComponent) {
                        // 如果异步组件加载超时，则渲染超时提示
                        return { 
                            type: finalOptions.errorComponent,
                            props: { error: error.value },
                        };
                    } else if (loading.value && finalOptions.loadingComponent) {
                        // 如果异步组件正在加载，则渲染加载提示
                        return {
                            type: finalOptions.loadingComponent,
                        };
                    }
                    
                    return placeholder;
                }
            },
        }
    };

    return {
        defineAsyncComponent,
        render,
        onMounted,
    }
}


export default createRenderer;
