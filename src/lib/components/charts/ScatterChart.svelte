<script lang="ts">
	import { Chart, ScatterController, PointElement, LinearScale, Tooltip } from 'chart.js';
	import { onMount } from 'svelte';

	Chart.register(ScatterController, PointElement, LinearScale, Tooltip);

	interface DataPoint {
		x: number;
		y: number;
	}

	interface Props {
		data: DataPoint[];
		xLabel?: string;
		yLabel?: string;
		title?: string;
		color?: string;
		height?: number;
	}

	let {
		data,
		xLabel = '',
		yLabel = '',
		title = '',
		color = '#3b82f6',
		height = 250
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'scatter',
			data: {
				datasets: [{
					data,
					backgroundColor: `${color}80`,
					borderColor: color,
					borderWidth: 1,
					pointRadius: 6,
					pointHoverRadius: 8
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: '#1a1a1a',
						titleColor: '#e5e5e5',
						bodyColor: '#a3a3a3',
						borderColor: '#333',
						borderWidth: 1,
						padding: 10,
						callbacks: {
							label: (ctx) => {
								const point = ctx.parsed;
								return `${xLabel}: ${point.x}, ${yLabel}: ${point.y}`;
							}
						}
					}
				},
				scales: {
					x: {
						title: {
							display: !!xLabel,
							text: xLabel,
							color: '#a3a3a3',
							font: { size: 11 }
						},
						grid: { color: '#333' },
						ticks: { color: '#a3a3a3', font: { size: 11 } }
					},
					y: {
						title: {
							display: !!yLabel,
							text: yLabel,
							color: '#a3a3a3',
							font: { size: 11 }
						},
						grid: { color: '#333' },
						ticks: { color: '#a3a3a3', font: { size: 11 } }
					}
				}
			}
		});

		return () => {
			chart?.destroy();
		};
	});

	$effect(() => {
		if (chart) {
			chart.data.datasets[0].data = data;
			chart.update();
		}
	});
</script>

<div class="chart-container">
	{#if title}
		<h3 class="chart-title">{title}</h3>
	{/if}
	<div class="chart-wrapper" style="height: {height}px">
		<canvas bind:this={canvas}></canvas>
	</div>
</div>

<style>
	.chart-container {
		width: 100%;
	}

	.chart-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-secondary);
		margin-bottom: 0.75rem;
	}

	.chart-wrapper {
		position: relative;
		width: 100%;
	}
</style>
