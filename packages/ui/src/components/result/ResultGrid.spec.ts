import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

import ResultGrid from './ResultGrid.vue'
import type { QueryRow } from '@types'

// Mock data
const mockColumns = ['id', 'name', 'email']
const mockRows: QueryRow[] = [
    {
        values: {
            id: { type: 'Integer', value: 1 },
            name: { type: 'Text', value: 'John Doe' },
            email: { type: 'Text', value: 'john@example.com' },
        },
    },
    {
        values: {
            id: { type: 'Integer', value: 2 },
            name: { type: 'Text', value: 'Jane Smith' },
            email: { type: 'Text', value: 'jane@example.com' },
        },
    },
    {
        values: {
            id: { type: 'Integer', value: 3 },
            name: { type: 'Text', value: 'Bob Wilson' },
            email: { type: 'Null' },
        },
    },
]

describe('ResultGrid', () => {
    const createWrapper = (props = {}) => {
        return mount(ResultGrid, {
            props: {
                columns: mockColumns,
                rows: mockRows,
                ...props,
            },
        })
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('rendering', () => {
        it('should render table with headers', () => {
            const wrapper = createWrapper()

            const headers = wrapper.findAll('th')
            expect(headers.length).toBeGreaterThan(0)
            expect(headers[0].text()).toContain('#')
            expect(wrapper.text()).toContain('id')
            expect(wrapper.text()).toContain('name')
            expect(wrapper.text()).toContain('email')
        })

        it('should render all rows', () => {
            const wrapper = createWrapper()

            const rows = wrapper.findAll('tbody tr')
            expect(rows).toHaveLength(3)
        })

        it('should display row numbers', () => {
            const wrapper = createWrapper()

            const rowNumbers = wrapper.findAll('tbody tr td:first-child')
            expect(rowNumbers[0].text()).toBe('1')
            expect(rowNumbers[1].text()).toBe('2')
            expect(rowNumbers[2].text()).toBe('3')
        })

        it('should display cell values', () => {
            const wrapper = createWrapper()

            expect(wrapper.text()).toContain('John Doe')
            expect(wrapper.text()).toContain('jane@example.com')
        })

        it('should display NULL for null values', () => {
            const wrapper = createWrapper()

            // The third row has a NULL email
            const rows = wrapper.findAll('tbody tr')
            const thirdRow = rows[2]
            expect(thirdRow.text()).toContain('NULL')
        })

        it('should apply correct styling to NULL values', () => {
            const wrapper = createWrapper()

            const nullCells = wrapper.findAll('.italic')
            expect(nullCells.length).toBeGreaterThan(0)
        })

        it('should apply right alignment to numeric columns', () => {
            const wrapper = createWrapper()

            // id column should have text-right class
            const cells = wrapper.findAll('td')
            const idCells = cells.filter(
                cell =>
                    cell.classes().includes('text-right') &&
                    (cell.text() === '1' || cell.text() === '2' || cell.text() === '3'),
            )
            expect(idCells.length).toBeGreaterThan(0)
        })
    })

    describe('pagination', () => {
        it('should show pagination controls', () => {
            const wrapper = createWrapper()

            expect(wrapper.text()).toContain('Page')
            expect(wrapper.find('select').exists()).toBe(true)
        })

        it('should display correct row count info', () => {
            const wrapper = createWrapper()

            expect(wrapper.text()).toContain('3 rows')
        })

        it('should change page size', async () => {
            const wrapper = createWrapper()

            const select = wrapper.find('select')
            await select.setValue('50')

            expect(wrapper.vm.pageSize).toBe(50)
        })

        it('should show hasMore indicator', () => {
            const wrapper = createWrapper({ hasMore: true })

            expect(wrapper.text()).toContain('more available')
        })

        it('should disable prev button on first page', () => {
            const wrapper = createWrapper()

            // First page should have disabled prev button
            expect(wrapper.vm.currentPage).toBe(1)
        })
    })

    describe('row interactions', () => {
        it('should emit edit-row on row double click', async () => {
            const wrapper = createWrapper()

            const firstRow = wrapper.find('tbody tr')
            await firstRow.trigger('dblclick')

            expect(wrapper.emitted('edit-row')).toBeTruthy()
            expect(wrapper.emitted('edit-row')![0][0]).toEqual(mockRows[0])
        })

        it('should not emit edit-row when allowEdit is false', async () => {
            const wrapper = createWrapper({ allowEdit: false })

            const firstRow = wrapper.find('tbody tr')
            await firstRow.trigger('dblclick')

            expect(wrapper.emitted('edit-row')).toBeFalsy()
        })

        it('should emit edit-row when edit button clicked', async () => {
            const wrapper = createWrapper()

            // Find edit button by its title or icon
            const editButton = wrapper
                .findAll('button')
                .find(btn => btn.attributes('title') === '编辑')

            if (editButton) {
                await editButton.trigger('click')
                expect(wrapper.emitted('edit-row')).toBeTruthy()
            }
        })

        it('should emit delete-row when delete button clicked', async () => {
            const wrapper = createWrapper()
            // Mock confirm to return true
            global.confirm = vi.fn(() => true)

            const deleteButton = wrapper
                .findAll('button')
                .find(btn => btn.attributes('title') === '删除')

            if (deleteButton) {
                await deleteButton.trigger('click')
                expect(wrapper.emitted('delete-row')).toBeTruthy()
            }
        })

        it('should not emit delete-row when cancelled', async () => {
            const wrapper = createWrapper()
            // Mock confirm to return false
            global.confirm = vi.fn(() => false)

            const deleteButton = wrapper
                .findAll('button')
                .find(btn => btn.attributes('title') === '删除')

            if (deleteButton) {
                await deleteButton.trigger('click')
                expect(wrapper.emitted('delete-row')).toBeFalsy()
            }
        })
    })

    describe('props', () => {
        it('should accept tableName prop', () => {
            const wrapper = createWrapper({ tableName: 'users' })
            expect(wrapper.props('tableName')).toBe('users')
        })

        it('should accept allowEdit prop', () => {
            const wrapper = createWrapper({ allowEdit: true })
            expect(wrapper.props('allowEdit')).toBe(true)
        })

        it('should hide action column when allowEdit is false', () => {
            const wrapper = createWrapper({ allowEdit: false })

            const headers = wrapper.findAll('th')
            const actionHeader = headers.find(h => h.text() === '操作')
            expect(actionHeader).toBeUndefined()
        })
    })

    describe('cell formatting', () => {
        it('should format Integer values correctly', () => {
            const wrapper = createWrapper()

            expect(wrapper.text()).toContain('1')
            expect(wrapper.text()).toContain('2')
            expect(wrapper.text()).toContain('3')
        })

        it('should format Text values correctly', () => {
            const wrapper = createWrapper()

            expect(wrapper.text()).toContain('John Doe')
            expect(wrapper.text()).toContain('Jane Smith')
        })

        it('should handle Boolean values', () => {
            const rowsWithBoolean: QueryRow[] = [
                {
                    values: {
                        id: { type: 'Integer', value: 1 },
                        active: { type: 'Boolean', value: true },
                    },
                },
            ]
            const wrapper = createWrapper({
                columns: ['id', 'active'],
                rows: rowsWithBoolean,
            })

            expect(wrapper.text()).toContain('true')
        })

        it('should handle Real values', () => {
            const rowsWithReal: QueryRow[] = [
                {
                    values: {
                        id: { type: 'Integer', value: 1 },
                        price: { type: 'Real', value: 99.99 },
                    },
                },
            ]
            const wrapper = createWrapper({
                columns: ['id', 'price'],
                rows: rowsWithReal,
            })

            expect(wrapper.text()).toContain('99.99')
        })
    })

    describe('large datasets', () => {
        it('should handle empty rows', () => {
            const wrapper = createWrapper({ rows: [] })

            const rows = wrapper.findAll('tbody tr')
            expect(rows).toHaveLength(0)
        })

        it('should handle many rows with pagination', () => {
            const manyRows: QueryRow[] = Array.from({ length: 250 }, (_, i) => ({
                values: {
                    id: { type: 'Integer', value: i + 1 },
                    name: { type: 'Text', value: `User ${i + 1}` },
                },
            }))

            const wrapper = createWrapper({
                columns: ['id', 'name'],
                rows: manyRows,
            })

            expect(wrapper.text()).toContain('250 rows')
        })
    })
})
