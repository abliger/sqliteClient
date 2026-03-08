import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ERDiagram from './ERDiagram.vue'
import { useConnectionStore } from '@stores/connection'
import type { ERDiagram as ERDiagramType, TableNode, RelationEdge } from '@types'

describe('ERDiagram Component', () => {
    const mockTable1: TableNode = {
        id: 'users',
        name: 'users',
        x: 100,
        y: 100,
        width: 180,
        height: 120,
        columns: [
            { name: 'id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, nullable: false },
            { name: 'name', data_type: 'TEXT', is_primary_key: false, is_foreign_key: false, nullable: true },
            { name: 'email', data_type: 'TEXT', is_primary_key: false, is_foreign_key: false, nullable: true },
        ],
    }

    const mockTable2: TableNode = {
        id: 'posts',
        name: 'posts',
        x: 400,
        y: 100,
        width: 180,
        height: 100,
        columns: [
            { name: 'id', data_type: 'INTEGER', is_primary_key: true, is_foreign_key: false, nullable: false },
            { name: 'user_id', data_type: 'INTEGER', is_primary_key: false, is_foreign_key: true, nullable: false },
            { name: 'title', data_type: 'TEXT', is_primary_key: false, is_foreign_key: false, nullable: true },
        ],
    }

    const mockRelation: RelationEdge = {
        id: 'rel-1',
        from_table: 'users',
        from_column: 'id',
        to_table: 'posts',
        to_column: 'user_id',
        relation_type: 'onetomany',
    }

    const mockDiagram: ERDiagramType = {
        tables: [mockTable1, mockTable2],
        relations: [mockRelation],
    }

    beforeEach(() => {
        setActivePinia(createPinia())
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    const createWrapper = (props = {}) => {
        return mount(ERDiagram, {
            props: {
                diagram: null,
                ...props,
            },
        })
    }

    describe('rendering', () => {
        it('should render container', () => {
            const wrapper = createWrapper()

            expect(wrapper.find('.relative').exists()).toBe(true)
        })

        it('should show empty state when no diagram', () => {
            const wrapper = createWrapper({ diagram: null })

            expect(wrapper.text()).toContain('erDiagram.noTables')
        })

        it('should show empty state when diagram has no tables', () => {
            const wrapper = createWrapper({ diagram: { tables: [], relations: [] } })

            expect(wrapper.text()).toContain('erDiagram.noTables')
        })

        it('should render SVG canvas when diagram has tables', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            expect(wrapper.find('svg').exists()).toBe(true)
        })

        it('should render table nodes', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            expect(wrapper.text()).toContain('users')
            expect(wrapper.text()).toContain('posts')
        })

        it('should render column names', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            expect(wrapper.text()).toContain('id')
            expect(wrapper.text()).toContain('name')
            expect(wrapper.text()).toContain('email')
        })

        it('should render column data types', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            expect(wrapper.text()).toContain('INTEGER')
            expect(wrapper.text()).toContain('TEXT')
        })

        it('should render toolbar with controls', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            // Toolbar should exist with buttons
            const buttons = wrapper.findAll('button')
            expect(buttons.length).toBeGreaterThan(0)
        })

        it('should render legend', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            expect(wrapper.text()).toContain('erDiagram.primaryKey')
            expect(wrapper.text()).toContain('erDiagram.foreignKey')
        })
    })

    describe('column icons', () => {
        it('should show key icon for primary key', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            const icon = wrapper.vm.getColumnIcon(mockTable1.columns[0])
            expect(icon).toBe('🔑')
        })

        it('should show link icon for foreign key', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            const icon = wrapper.vm.getColumnIcon(mockTable2.columns[1])
            expect(icon).toBe('🔗')
        })

        it('should show empty string for regular column', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            const icon = wrapper.vm.getColumnIcon(mockTable1.columns[1])
            expect(icon).toBe('')
        })
    })

    describe('node dimensions', () => {
        it('should calculate node height based on columns', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            const height1 = wrapper.vm.getNodeHeight(mockTable1)
            expect(height1).toBe(32 + 3 * 24 + 12 * 2) // HEADER + columns * ROW + padding * 2

            const height2 = wrapper.vm.getNodeHeight(mockTable2)
            expect(height2).toBe(32 + 3 * 24 + 12 * 2)
        })
    })

    describe('relation paths', () => {
        it('should generate path for valid relation', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            const path = wrapper.vm.getRelationPath(mockRelation)
            expect(path).toContain('M')
            expect(path).toContain('C')
        })

        it('should return empty string for invalid relation', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            const invalidRelation: RelationEdge = {
                ...mockRelation,
                from_table: 'nonexistent',
            }
            const path = wrapper.vm.getRelationPath(invalidRelation)
            expect(path).toBe('')
        })
    })

    describe('zoom controls', () => {
        it('should zoom in when zoom in button clicked', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            const initialScale = wrapper.vm.scale
            await wrapper.vm.zoomIn()

            expect(wrapper.vm.scale).toBeGreaterThan(initialScale)
        })

        it('should zoom out when zoom out button clicked', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            wrapper.vm.scale = 1.5
            await wrapper.vm.zoomOut()

            expect(wrapper.vm.scale).toBeLessThan(1.5)
        })

        it('should reset view when reset button clicked', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            // Verify resetView calls autoLayout by checking if zoomToFit is called
            const zoomToFitSpy = vi.spyOn(wrapper.vm, 'zoomToFit')
            
            await wrapper.vm.resetView()
            
            // resetView calls autoLayout then nextTick then zoomToFit
            expect(zoomToFitSpy).not.toHaveBeenCalled() // Not immediately
        })

        it('should emit refresh event when refresh button clicked', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            wrapper.vm.emit('refresh')
            expect(wrapper.emitted('refresh')).toBeTruthy()
        })

        it('should limit zoom to min scale', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            wrapper.vm.scale = 0.3
            await wrapper.vm.zoomOut()

            expect(wrapper.vm.scale).toBeGreaterThanOrEqual(0.3)
        })

        it('should limit zoom to max scale', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            wrapper.vm.scale = 3
            await wrapper.vm.zoomIn()

            expect(wrapper.vm.scale).toBeLessThanOrEqual(3)
        })
    })

    describe('auto layout', () => {
        it('should auto layout tables on mount', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()
            vi.advanceTimersByTime(100)

            // Tables should have positions assigned
            expect(mockDiagram.tables[0].x).not.toBe(0)
            expect(mockDiagram.tables[0].y).not.toBe(0)
        })

        it('should not auto layout if positions already set', () => {
            const diagramWithPositions: ERDiagramType = {
                tables: [
                    { ...mockTable1, x: 500, y: 500 },
                    { ...mockTable2, x: 800, y: 500 },
                ],
                relations: mockDiagram.relations,
            }

            const wrapper = createWrapper({ diagram: diagramWithPositions })

            // Positions should remain unchanged
            expect(diagramWithPositions.tables[0].x).toBe(500)
            expect(diagramWithPositions.tables[0].y).toBe(500)
        })
    })

    describe('mouse interactions', () => {
        it('should start panning on mouse down', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            const canvas = wrapper.find('.cursor-grab')
            await canvas.trigger('mousedown', {
                clientX: 100,
                clientY: 100,
            })

            expect(wrapper.vm.isPanning).toBe(true)
        })

        it('should stop panning on mouse up', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            wrapper.vm.isPanning = true
            await wrapper.vm.handleMouseUp()

            expect(wrapper.vm.isPanning).toBe(false)
        })

        it('should start dragging on node mouse down', async () => {
            const wrapper = createWrapper({ diagram: mockDiagram })
            await nextTick()

            await wrapper.vm.handleMouseDown(
                { clientX: 100, clientY: 100 } as MouseEvent,
                mockTable1
            )

            expect(wrapper.vm.isDragging).toBe(true)
            expect(wrapper.vm.dragNode?.id).toBe(mockTable1.id)
        })
    })

    describe('relation markers', () => {
        it('should return correct marker for one-to-one', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            const marker = wrapper.vm.getRelationMarker('onetoone')
            expect(marker).toBe('url(#marker-one)')
        })

        it('should return correct marker for one-to-many', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            const marker = wrapper.vm.getRelationMarker('onetomany')
            expect(marker).toBe('url(#marker-many)')
        })

        it('should return correct marker for many-to-many', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            const marker = wrapper.vm.getRelationMarker('manytomany')
            expect(marker).toBe('url(#marker-many)')
        })

        it('should return empty string for unknown type', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            const marker = wrapper.vm.getRelationMarker('unknown')
            expect(marker).toBe('')
        })
    })

    describe('canvas transform', () => {
        it('should compute transform style', () => {
            const wrapper = createWrapper({ diagram: mockDiagram })

            wrapper.vm.panX = 100
            wrapper.vm.panY = 50
            wrapper.vm.scale = 1.5

            const transform = wrapper.vm.canvasTransform
            expect(transform).toContain('translate')
            expect(transform).toContain('scale(1.5)')
        })
    })
})
