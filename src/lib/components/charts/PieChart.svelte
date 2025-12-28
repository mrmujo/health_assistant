<script lang="ts">
	import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
	import { onMount } from 'svelte';

	Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

	interface Props {
		labels: string[];
		data: number[];
		title?: string;
		colors?: string[];
		height?: number;
	}

	let {
		labels,
		data,
		title = '',
		colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316'],
		height = 200
	}: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [{
					data,
					backgroundColor: colors,
					borderColor: '#1a1a1a',
					borderWidth: 2
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							color: '#a3a3a3',
							font: { size: 11 },
							padding: 15,
							usePointStyle: true,
							pointStyle: 'circle'
						}
					},
					tooltip: {
						backgroundColor: '#1a1a1a',
						titleColor: '#e5e5e5',
						bodyColor: '#a3a3a3',
						borderColor: '#333',
						borderWidth: 1,
						padding: 10
					}
				},
				cutout: '60%'
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
		text-align: center;
	}

	.chart-wrapper {
		position: relative;
		width: 100%;
	}
</style>
