<script lang="ts">
	import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js';
	import { onMount } from 'svelte';

	Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

	interface Props {
		labels: string[];
		data: (number | null)[];
		title?: string;
		color?: string;
		fill?: boolean;
		height?: number;
	}

	let { labels, data, title = '', color = '#3b82f6', fill = true, height = 200 }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels,
				datasets: [{
					data,
					borderColor: color,
					backgroundColor: fill ? `${color}20` : 'transparent',
					fill,
					tension: 0.3,
					pointRadius: 3,
					pointHoverRadius: 5,
					pointBackgroundColor: color
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
						displayColors: false
					}
				},
				scales: {
					x: {
						grid: { color: '#333' },
						ticks: { color: '#a3a3a3', font: { size: 11 } }
					},
					y: {
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
			chart.data.labels = labels;
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
