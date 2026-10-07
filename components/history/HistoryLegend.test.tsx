import { render } from "@testing-library/react-native";
import "@/i18n";
import { HistoryLegend } from "@/components/history/HistoryLegend";

it("explains all four piece metrics and only technique metrics on techniques", async () => {
	const screen = await render(<HistoryLegend kind="piece" />);
	for (const label of ["Quality", "Effort", "Technical", "Memory"]) {
		expect(screen.getByText(label)).toBeTruthy();
	}
	await screen.rerender(<HistoryLegend kind="technique" />);
	expect(screen.getByText("Quality")).toBeTruthy();
	expect(screen.getByText("Effort")).toBeTruthy();
	expect(screen.queryByText("Technical")).toBeNull();
	expect(screen.queryByText("Memory")).toBeNull();
});
